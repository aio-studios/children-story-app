// End-to-end verification of the Settings screen and the now-live sample cards (UAT, 2026-09-26).
//
// Covers three UAT findings:
//   - there was no way to sign out at all (signOut() had zero callers)
//   - Settings sat in the nav badged "Soon" and disabled
//   - the "Popular this week" / "Quick stories" cards were inert <div>s
//
// Costs nothing: no stories are generated and no rows are seeded. It does sign the test user in and
// out, but never writes to their library.
//
//   npm run dev  &&  node scripts/verify-settings.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = REPO + '/.playwright-shots';
const APP = 'http://localhost:3000';

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(URL_).hostname.split('.')[0];

async function signIn() {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
  });
  const s = await res.json();
  if (!s.access_token) throw new Error('sign-in failed: ' + JSON.stringify(s));
  return s;
}

// Re-fetched rather than reused, because the sign-out test below genuinely revokes this session -
// which is the point of that test. Any later context needs a NEW one; handing it the dead cookies
// renders the signed-out pane and reads as a styling failure at dark/tablet rather than what it is.
let session = await signIn();

function cookies() {
  const stored = {
    access_token: session.access_token, token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token, user: session.user,
  };
  return createChunks(`sb-${ref}-auth-token`, 'base64-' + stringToBase64URL(JSON.stringify(stored)))
    .map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
}

let pass = 0, fail = 0;
const check = (n, c, extra = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + ' ' + extra)); };

fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
const browser = await chromium.launch();
const IPHONE = { width: 390, height: 844 };
const IPAD = { width: 820, height: 1180 };
const HIDE = 'nextjs-portal { display: none !important; }';
const errs = [];
const watch = p => { p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e))); return p; };

// ------------------------------------------------------------- guest ----
console.log('\nSETTINGS AS A GUEST');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/settings', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(700);

  check('the Settings screen renders', await p.locator('.sk-set-title').isVisible());
  check('a guest is offered the sign-in form', await p.locator('.sk-set-form input[type="email"]').isVisible());
  check('no "Sign out" is offered to someone signed out', await p.locator('.sk-set-signout').count() === 0);
  check('it says stories are device-only', /this device only/i.test(await p.locator('.sk-set-card').innerText()));
  await p.screenshot({ path: SHOTS + '/settings-guest.png', fullPage: true });
  await ctx.close();
}

// --------------------------------------------------------- nav is live ----
console.log('\nTHE NAV ITEM IS NO LONGER "SOON"');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(500);

  const item = p.locator('.sk-appnav-item', { hasText: 'Settings' }).first();
  check('Settings is in the nav', await item.count() === 1);
  check('it is not disabled', !(await item.isDisabled()));
  check('it carries no "Soon" badge', await item.locator('.sk-appnav-soon').count() === 0);
  check('Music is still honestly marked "Soon"',
    await p.locator('.sk-appnav-item', { hasText: 'Music' }).first().isDisabled());

  await item.click();
  await p.waitForURL('**/settings', { timeout: 8000 }).catch(() => {});
  check('tapping it lands on /settings', new URL(p.url()).pathname === '/settings', p.url());
  await ctx.close();
}

// ----------------------------------------------------------- signed in ----
console.log('\nSETTINGS SIGNED IN, AND SIGNING OUT');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  await ctx.addCookies(cookies());
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/settings', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(900);

  const email = env.TEST_USER_EMAIL;
  check('the signed-in email is shown', (await p.locator('.sk-set-row-value').innerText()).trim() === email);
  check('"Sign out" is offered', await p.locator('.sk-set-signout').isVisible());
  check('the sign-in form is gone', await p.locator('.sk-set-form').count() === 0);
  await p.screenshot({ path: SHOTS + '/settings-signed-in.png', fullPage: true });

  // The actual point of the whole screen.
  await p.locator('.sk-set-signout').click();
  await p.locator('.sk-set-form input[type="email"]').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  check('signing out returns the signed-out pane', await p.locator('.sk-set-form input[type="email"]').isVisible());
  check('and "Sign out" is gone with it', await p.locator('.sk-set-signout').count() === 0);

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  check('it survives a reload - the session really ended',
    await p.locator('.sk-set-form input[type="email"]').isVisible());
  await ctx.close();
}

// ------------------------------------------------- the sample cards ----
console.log('\nTHE SAMPLE CARDS ARE REAL BUTTONS NOW');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(600);

  const row = p.locator('.sk-drow', { has: p.locator('text=Popular this week') });
  check('the sample shelf is there for a guest', await row.isVisible());
  const card = row.locator('button.sk-cover-card').first();
  check('its cards are <button>, not inert <div>', await card.count() === 1);
  check('the action is named for a screen reader',
    /make a .* style story/i.test(await card.getAttribute('aria-label') ?? ''));

  // "The Kindness Dragon" is genreId fantasy - tapping it should open setup on that genre.
  await card.click();
  await p.waitForTimeout(900);
  const deck = p.locator('.sk-deck, [class*="sk-deck"]').first();
  check('tapping one opens the setup deck', await deck.count() > 0 || !(await row.isVisible()),
    'still on Home');
  await p.screenshot({ path: SHOTS + '/settings-card-tap.png', fullPage: true });
  await ctx.close();
}

// --------------------------------------------------- dark and tablet ----
console.log('\nDARK AND TABLET');
session = await signIn(); // the sign-out above revoked the previous one
for (const [label, viewport, scheme] of [
  ['iphone-dark', IPHONE, 'dark'],
  ['ipad-light', IPAD, 'light'],
  ['ipad-dark', IPAD, 'dark'],
]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  await ctx.addCookies(cookies());
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/settings', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(900);
  check(`Settings renders at ${label}`, await p.locator('.sk-set-card').isVisible());
  check(`"Sign out" is reachable at ${label}`, await p.locator('.sk-set-signout').isVisible());
  const box = await p.locator('.sk-set-card').boundingBox();
  check(`the card fits the viewport at ${label}`, !!box && box.width <= viewport.width, JSON.stringify(box));
  await p.screenshot({ path: SHOTS + `/settings-${label}.png`, fullPage: true });
  await ctx.close();
}

check('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass}/${pass + fail} passed`);
console.log('screenshots: ' + SHOTS);
process.exit(fail ? 1 : 0);

// End-to-end verification of Delete account (#92 Step 9).
//
// Creates a brand-new ANONYMOUS account each run (dev project only: "Allow anonymous sign-ins" must
// be on), gives it stories with two real cover Blobs, deletes it through the real Settings screen,
// then proves the stories, the covers and the account are all gone. Nothing to clean up afterwards:
// the account it deletes is one it just made, so TEST_USER_EMAIL is never touched.
//
// Free: covers are tiny PNGs uploaded straight to Blob, not generated.
//
//   npm run dev  &&  node scripts/verify-delete-account.mjs

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = REPO + '/.playwright-shots';
const APP = 'http://localhost:3000';

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');
const { head, put, del } = await import(REPO + '/node_modules/@vercel/blob/dist/index.js');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(URL_).hostname.split('.')[0];
const blobToken = env.BLOB_READ_WRITE_TOKEN;

let pass = 0, fail = 0;
const check = (n, c, extra = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + ' ' + extra); }
};

// Only "not found" means deleted - see verify-cover-lifecycle.mjs for why a public HEAD isn't proof.
const blobExists = async (url) => {
  try {
    await head(url, { token: blobToken });
    return true;
  } catch (e) {
    if (e?.name === 'BlobNotFoundError' || /does not exist/i.test(e?.message ?? '')) return false;
    throw e;
  }
};

const isReferenced = async (url) => (await (await fetch(`${URL_}/rest/v1/rpc/cover_is_referenced`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_url: url }),
})).json());

// A 1x1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

console.log('\nTHE GUARDS (no account needed)');
{
  const noConfirm = await fetch(APP + '/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('refuses a request without confirm: "DELETE"', noConfirm.status === 400, `got ${noConfirm.status}`);
  const noUser = await fetch(APP + '/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) });
  check('refuses a signed-out request', noUser.status === 401, `got ${noUser.status}`);
}

console.log('\nSETUP: a fresh anonymous account with 3 stories, 2 with real covers');
const signup = await fetch(`${URL_}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}',
});
const session = await signup.json();
if (!session.access_token) {
  throw new Error('anonymous sign-up failed - is "Allow anonymous sign-ins" on for the DEV project? ' + JSON.stringify(session));
}
const auth = { apikey: KEY, Authorization: `Bearer ${session.access_token}` };

const covers = [];
for (let i = 0; i < 2; i++) {
  const { url } = await put(`story-covers/verify-delete-${randomUUID()}.png`, PNG, { access: 'public', token: blobToken, contentType: 'image/png' });
  covers.push(url);
}
for (const [i, image_url] of [[0, covers[0]], [1, covers[1]], [2, null]]) {
  const r = await fetch(`${URL_}/rest/v1/stories`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: session.user.id, mode: 'classic', title: `Delete me ${i}`,
      selections: {
        genre: { type: 'preset', genreId: 'fantasy' }, character: { type: 'preset', characterId: 'ember' },
        length: 'quick', readingLevel: 'early-reader', tone: 'playful', lesson: { type: 'preset', lessonId: 'kindness' },
      },
      content: { story: 'Once upon a time. The end.' }, image_url,
    }),
  });
  if (!r.ok) throw new Error('seed failed: ' + await r.text());
}
check('both covers exist before', (await blobExists(covers[0])) && (await blobExists(covers[1])));
check('the covers are referenced before', (await isReferenced(covers[0])) === true);

function cookies() {
  const stored = {
    access_token: session.access_token, token_type: session.token_type, expires_in: session.expires_in,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token, user: session.user,
  };
  return createChunks(`sb-${ref}-auth-token`, 'base64-' + stringToBase64URL(JSON.stringify(stored)))
    .map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
}

fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
const browser = await chromium.launch();
const HIDE = 'nextjs-portal { display: none !important; }';
const errs = [];

try {
  console.log('\nTHE SCREEN');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies(cookies());
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(APP + '/settings', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });

  const open = p.getByRole('button', { name: 'Delete my account' });
  await open.waitFor({ timeout: 15000 });
  check('a signed-in user sees "Delete my account"', await open.isVisible());
  await open.click();

  const forever = p.getByRole('button', { name: 'Delete forever' });
  const box = p.getByLabel(/Type DELETE to confirm/);
  check('"Delete forever" starts disabled', await forever.isDisabled());
  await box.fill('delete');
  check('lowercase "delete" does not enable it', await forever.isDisabled());
  await box.fill('DELETE');
  check('typing DELETE enables it', await forever.isEnabled());
  check('the confirm label reads as one line', await p.evaluate(() => {
    const span = [...document.querySelectorAll('.sk-set-confirm > span')][0];
    return !!span && span.getClientRects().length <= 1 && span.getBoundingClientRect().height < 40;
  }));
  await p.screenshot({ path: SHOTS + '/step9-delete-confirm-light.png', fullPage: true });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.screenshot({ path: SHOTS + '/step9-delete-confirm-dark.png', fullPage: true });
  await p.emulateMedia({ colorScheme: 'light' });

  await forever.click();
  const done = p.getByRole('status').filter({ hasText: 'Your account and all its stories have been deleted.' });
  let doneShown = true;
  try { await done.waitFor({ timeout: 20000 }); } catch { doneShown = false; }
  check('says the account was deleted', doneShown);
  check('drops back to the signed-out pane', await p.getByRole('button', { name: /send|email me|link/i }).first().isVisible());
  check('the delete card is gone', (await p.getByRole('button', { name: 'Delete my account' }).count()) === 0);
  await p.screenshot({ path: SHOTS + '/step9-delete-done-light.png', fullPage: true });
  await ctx.close();

  console.log('\nTHE AFTERMATH');
  check('cover 1 is deleted from Blob', !(await blobExists(covers[0])));
  check('cover 2 is deleted from Blob', !(await blobExists(covers[1])));
  check('no story row references the covers any more', (await isReferenced(covers[0])) === false && (await isReferenced(covers[1])) === false);
  // Not "can the session refresh?": signing out kills the session too, so that would pass even if the
  // account survived. The access token is still a validly signed JWT, so asking who it belongs to
  // makes the auth server look the user up - and only a deleted user answers user_not_found.
  const who = await fetch(`${URL_}/auth/v1/user`, { headers: auth });
  const whoBody = await who.json().catch(() => ({}));
  check('the account itself is deleted (auth server: user_not_found)', whoBody.error_code === 'user_not_found', `got ${who.status} ${JSON.stringify(whoBody)}`);

  console.log('\nGUEST + PRIVACY');
  for (const scheme of ['light', 'dark']) {
    const g = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const gp = await g.newPage();
    gp.on('pageerror', e => errs.push(String(e)));
    await gp.goto(APP + '/settings', { waitUntil: 'networkidle' });
    await gp.waitForTimeout(800);
    if (scheme === 'light') {
      check('a guest sees no delete option', (await gp.getByRole('button', { name: 'Delete my account' }).count()) === 0);
      check('Settings links to the privacy page', await gp.getByRole('link', { name: /privacy/i }).isVisible());
    }
    const res = await gp.goto(APP + '/privacy', { waitUntil: 'networkidle' });
    if (scheme === 'light') {
      check('/privacy loads', res?.status() === 200, `got ${res?.status()}`);
      check('/privacy says accounts are for grown-ups', await gp.getByRole('heading', { name: 'Storykins is for grown-ups' }).isVisible());
      check('/privacy fits a phone (no sideways scroll)', await gp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await gp.screenshot({ path: SHOTS + `/step9-privacy-${scheme}.png`, fullPage: true });
    if (scheme === 'light') {
      await gp.goto(APP + '/', { waitUntil: 'networkidle' });
      check('the landing footer links to privacy', await gp.locator('footer').getByRole('link', { name: 'Privacy' }).isVisible());
    }
    await g.close();
  }
  check('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close();
  // Belt and braces: if a check failed before the delete ran, don't leave the test covers behind.
  for (const url of covers) await del(url, { token: blobToken }).catch(() => {});
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

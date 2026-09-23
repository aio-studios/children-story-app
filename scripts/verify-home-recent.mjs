// End-to-end verification of Home's real Recent shelf (#92 Step 8, closes #67).
//
// DESTRUCTIVE: deletes every story belonging to TEST_USER_EMAIL. Throwaway account only.
//
// Rows are seeded through PostgREST rather than generated - this is about what Home renders, and
// real generation would cost money and minutes without testing anything extra.
//
//   npm run dev  &&  node scripts/verify-home-recent.mjs

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

const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
});
const session = await res.json();
if (!session.access_token) throw new Error('sign-in failed: ' + JSON.stringify(session));
const auth = { apikey: KEY, Authorization: `Bearer ${session.access_token}` };

const wipe = () => fetch(`${URL_}/rest/v1/stories?id=neq.00000000-0000-0000-0000-000000000000`,
  { method: 'DELETE', headers: { ...auth, Prefer: 'return=minimal' } });

async function seed({ title, genreId, progress = 0 }) {
  const r = await fetch(`${URL_}/rest/v1/stories`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: session.user.id, mode: 'classic', title,
      selections: {
        genre: { type: 'preset', genreId }, character: { type: 'preset', characterId: 'ember' },
        length: 'quick', readingLevel: 'early-reader', tone: 'playful',
        lesson: { type: 'preset', lessonId: 'kindness' },
      },
      content: { story: `Once upon a time, ${title} began. The end.` },
      image_url: null, progress, time_spent: 0, opened: false,
    }),
  });
  const [row] = await r.json();
  if (!row?.id) throw new Error('seed failed: ' + JSON.stringify(row));
  return row;
}

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
const HIDE = 'nextjs-portal { display: none !important; }';
const errs = [];
const watch = p => { p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e))); return p; };

const recentRow = p => p.locator('.sk-drow', { has: p.locator('text=Your recent stories') });
const discoveryRow = p => p.locator('.sk-drow', { has: p.locator('text=Popular this week') });

// ------------------------------------------------------------------ guest ----
console.log('\nGUEST (nothing real to show)');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(600);
  check('no "Your recent stories" shelf for a guest', await recentRow(p).count() === 0);
  check('the sample shelves stay, so Home is not empty', await discoveryRow(p).isVisible());
  await p.screenshot({ path: SHOTS + '/step8-home-guest.png', fullPage: true });
  await ctx.close();
}

// -------------------------------------------------- signed in, no stories ----
console.log('\nSIGNED IN, ZERO STORIES');
await wipe();
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  await ctx.addCookies(cookies());
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(1500);
  check('no Recent shelf when the library is empty', await recentRow(p).count() === 0);
  check('sample shelves fill the gap instead of an empty Home', await discoveryRow(p).isVisible());
  await ctx.close();
}

// ------------------------------------------------ signed in, real stories ----
console.log('\nSIGNED IN, REAL STORIES');
const seeded = [];
for (const [title, genreId, progress] of [
  ['The Kindness Dragon', 'fantasy', 0.4],
  ['Coco and the Long Way Home', 'animals', 0],
  ['Nova Builds a Friend', 'sci-fi', 0.9],
  ['Willow and the Last Star', 'bedtime', 0],
  ['Pip Climbs the Cloud Peak', 'adventure', 0.2],
  ['Baxter Finds the Honey', 'animals', 0],
  ['Cosmo Meets a Comet', 'sci-fi', 0],
  ['Ember and the Tiny Spark', 'fantasy', 0],
]) { seeded.push(await seed({ title, genreId, progress })); }
console.log(`  seeded ${seeded.length} stories`);
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  await ctx.addCookies(cookies());
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await recentRow(p).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check('the Recent shelf appears', await recentRow(p).isVisible());

  const cards = recentRow(p).locator('.sk-cover-card-live');
  const cardCount = await cards.count();
  check('it caps at 6 cards, not the whole library', cardCount === 6, `got ${cardCount}`);
  check('newest story is first', (await cards.first().textContent())?.includes('Ember and the Tiny Spark'), await cards.first().textContent());
  check('a card shows its read progress', (await recentRow(p).textContent())?.includes('%'));

  check('the invented shelves are GONE now there is something real', await discoveryRow(p).count() === 0);
  await p.screenshot({ path: SHOTS + '/step8-home-signed-in.png', fullPage: true });

  // "All" is the shelf's door to the Library.
  await p.getByRole('button', { name: /^All/ }).click();
  await p.waitForURL('**/library', { timeout: 10000 }).catch(() => {});
  check('"All" goes to the Library', p.url().includes('/library'), p.url());

  // Tapping a card opens that story - with no /create?story= round trip, since Home already has the row.
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await recentRow(p).waitFor({ state: 'visible', timeout: 15000 });
  const target = await recentRow(p).locator('.sk-cover-card-live').nth(1).textContent();
  await recentRow(p).locator('.sk-cover-card-live').nth(1).click();
  await p.locator('.story-reader-story').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check('tapping a card opens the reader', await p.locator('.story-reader-story').isVisible());
  const readerTitle = (await p.locator('.story-reader-title').textContent()) ?? ' ';
  check('it opened the story that was tapped', target?.includes(readerTitle), `card="${target}" reader="${readerTitle}"`);
  check('no spinner: the row was already in hand, so no refetch', await p.locator('.sk-opening').count() === 0);
  check('the URL stays clean (no ?story= round trip)', !p.url().includes('story='), p.url());

  // Opening from Home marks the row opened, same as the Library path - so a later regenerate lands beside it.
  await p.waitForTimeout(1200);
  const rows = await (await fetch(`${URL_}/rest/v1/stories?select=id,title,opened`, { headers: auth })).json();
  const opened = rows.filter(r => r.opened);
  check('opening from Home marks exactly that row opened', opened.length === 1, JSON.stringify(opened.map(r => r.title)));
  await ctx.close();
}

// ---------------------------------------------------------- dark + tablet ----
console.log('\nDARK AND TABLET');
for (const [name, viewport, scheme] of [['dark', IPHONE, 'dark'], ['ipad', { width: 834, height: 1112 }, 'light']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  await ctx.addCookies(cookies());
  const p = watch(await ctx.newPage());
  await p.goto(APP + '/create', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await recentRow(p).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check(`Recent shelf renders at ${name}`, await recentRow(p).isVisible());
  await p.screenshot({ path: `${SHOTS}/step8-home-${name}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
await wipe();
const noisy = errs.filter(e => !/favicon|React DevTools/i.test(e));
check('no console errors', noisy.length === 0, noisy.slice(0, 3).join(' | '));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

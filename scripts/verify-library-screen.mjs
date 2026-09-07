// End-to-end verification of the Library screen + nav (#92, Step 6).
//
// Drives the real screen in a real browser, as a guest and as a real signed-in user, and checks the
// database after every mutation - the UI saying "deleted" is not evidence the row went.
//
// ⚠️  DESTRUCTIVE: deletes every story belonging to TEST_USER_EMAIL, before and after the run.
//    Point it at a dedicated throwaway account. Never at a real one.
//
// Rows are seeded straight through PostgREST rather than by generating stories: this suite is about
// the screen, and 18 real generations would cost money and minutes without testing anything extra.
// (The cover-blob suite is the opposite case - there, fake data would make the test meaningless.)
//
//   npm run dev  &&  node scripts/verify-library-screen.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = REPO + '/.playwright-shots';

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = new URL(URL_).hostname.split('.')[0];

async function signIn() {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
  });
  const s = await res.json();
  if (!s.access_token) throw new Error('sign-in failed: ' + JSON.stringify(s));
  return s;
}

function sessionCookies(session, ref) {
  const stored = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token,
    user: session.user,
  };
  const value = 'base64-' + stringToBase64URL(JSON.stringify(stored));
  return createChunks(`sb-${ref}-auth-token`, value).map(c => ({
    name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }));
}

const session = await signIn();
const token = session.access_token;
const auth = { apikey: KEY, Authorization: `Bearer ${token}` };

const rows = async () => (await fetch(
  `${URL_}/rest/v1/stories?select=id,title,mode,image_url,progress,time_spent,opened&order=updated_at.desc`,
  { headers: auth })).json();

const wipe = () => fetch(`${URL_}/rest/v1/stories?id=neq.00000000-0000-0000-0000-000000000000`,
  { method: 'DELETE', headers: { ...auth, Prefer: 'return=minimal' } });

// Seeds one classic row. `selections` / `content` mirror lib/stories.ts exactly - a shape the mapper
// rejects comes back as a dropped row, which would read here as "the grid is broken".
async function seed({ title, genreId, progress = 0, timeSpent = 0, opened = false, createdAt = null }) {
  const res = await fetch(`${URL_}/rest/v1/stories`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: session.user.id,
      mode: 'classic',
      title,
      selections: {
        genre: { type: 'preset', genreId },
        character: { type: 'preset', characterId: 'ember' },
        length: 'quick',
        readingLevel: 'early-reader',
        tone: 'playful',
        lesson: { type: 'preset', lessonId: 'kindness' },
      },
      content: { story: `Once upon a time, ${title} began. The end.` },
      image_url: null,
      progress,
      time_spent: timeSpent,
      opened,
      // Only set when a test needs an OLD story. `updated_at` is left at now() either way, which is
      // the whole point: the card must date itself from created_at, not from the column every touch
      // bumps.
      ...(createdAt ? { created_at: createdAt } : {}),
    }),
  });
  const [row] = await res.json();
  if (!row?.id) throw new Error('seed failed: ' + JSON.stringify(row));
  return row;
}

let pass = 0, fail = 0;
const check = (n, c, extra = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + ' ' + extra)); };

fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
const browser = await chromium.launch();

const IPHONE = { width: 390, height: 844 };
const IPAD = { width: 834, height: 1112 };

const consoleErrors = [];
function watch(page) {
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
  return page;
}

// The dev overlay (<nextjs-portal>) sits above the whole page and swallows clicks on the bottom nav.
// Hidden rather than force-clicked, so a click that genuinely misses its target still fails.
const HIDE_DEV_OVERLAY = 'nextjs-portal { display: none !important; }';
async function go(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
}

// ---------------------------------------------------------------- guest ----
console.log('\nGUEST');
{
  const ctx = await browser.newContext({ viewport: IPHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = watch(await ctx.newPage());
  await go(page, 'http://localhost:3000/library');

  check('guest sees the Library heading', await page.locator('.sk-lib-h1').innerText() === 'Your library');
  check('guest sees the sign-in pitch', await page.locator('.sk-lib-guest-h').isVisible());
  check('guest gets a working email field', await page.locator('#sk-signin-email').isVisible());
  check('guest sees no capacity meter', await page.locator('.sk-lib-cap').count() === 0);
  check('guest sees no story cards', await page.locator('.sk-lib-card').count() === 0);

  // A bad address must be refused in the browser, not by spending one of Brevo's 300 daily emails.
  await page.locator('#sk-signin-email').fill('not-an-email');
  await page.locator('.sk-signin-go').click();
  await page.waitForTimeout(200);
  check('bad address is refused client-side', await page.locator('#sk-signin-error').isVisible());

  await page.screenshot({ path: SHOTS + '/library-guest-light.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: SHOTS + '/library-guest-dark.png', fullPage: true });

  // Library seat is live in the bottom bar, and Home crosses back to /create.
  check('nav shows a Library seat', await page.locator('button[aria-label="Library"]').count() === 1);
  check('Favorites seat is gone', await page.locator('button[aria-label="Favorites (coming soon)"]').count() === 0);
  await page.locator('button[aria-label="Home"]').click();
  await page.waitForURL('**/create');
  check('Home from the Library lands on /create', page.url().endsWith('/create'));

  await ctx.close();
}

// ------------------------------------------------------------ signed in ----
console.log('\nSIGNED IN');
await wipe();
const GENRES = ['fantasy', 'animals', 'sci-fi', 'bedtime', 'adventure'];
const seeded = [];
// 18 stories: one past the warning threshold (17), two short of the cap, so the meter shows both a
// count and a warning without eviction firing during the run.
for (let i = 0; i < 18; i++) {
  seeded.push(await seed({
    title: `Test Story ${String(i + 1).padStart(2, '0')}`,
    genreId: GENRES[i % GENRES.length],
    progress: i === 17 ? 0.62 : 0,
  }));
}
// One deliberately old story, to prove the card dates from when it was MADE. Seeded last so it is
// the newest by updated_at and therefore the first card on screen.
const OLD_DAYS = 40;
const oldStory = await seed({
  title: 'An Older Story',
  genreId: 'bedtime',
  createdAt: new Date(Date.now() - OLD_DAYS * 86400000).toISOString(),
});
check('19 rows seeded', (await rows()).length === 19);

const ctx = await browser.newContext({ viewport: IPHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addCookies(sessionCookies(session, projectRef));
const page = watch(await ctx.newPage());
await go(page, 'http://localhost:3000/library');
await page.waitForSelector('.sk-lib-card');

check('all 19 stories render as cards', await page.locator('.sk-lib-card').count() === 19);
check('capacity meter reads 19 of 20', (await page.locator('.sk-lib-cap-row').innerText()).includes('19 of 20 saved'));
check('capacity warning is showing past 17', await page.locator('.sk-lib-cap-warn').isVisible());
check('most recently touched story is first', (await page.locator('.sk-lib-title').first().innerText()) === 'An Older Story');
// The old story was written 40 days ago but touched seconds ago. If the card read `updated_at` it
// would say "Today" - the whole point of dating it from created_at.
check('card dates a story from when it was made, not last touched',
  (await page.locator('.sk-lib-sub').first().innerText()) === 'Bedtime · 5 weeks ago',
  await page.locator('.sk-lib-sub').first().innerText());
check('a part-read story shows its progress',
  (await page.locator('.sk-lib-progress').first().innerText()) === '62%');

await page.screenshot({ path: SHOTS + '/library-signedin-light.png', fullPage: true });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: SHOTS + '/library-signedin-dark.png', fullPage: true });
await page.emulateMedia({ colorScheme: 'light' });

// --- Favourites shell
await page.locator('#sk-lib-tab-favourites').click();
check('Favourites tab shows its empty shell', (await page.locator('.sk-lib-empty-a').innerText()) === 'No favourites yet');
check('Favourites is labelled as not shipped', await page.locator('.sk-lib-soon').isVisible());
check('Favourites hides the History grid', await page.locator('.sk-lib-card').count() === 0);
await page.screenshot({ path: SHOTS + '/library-favourites.png', fullPage: true });
await page.locator('#sk-lib-tab-history').click();
check('History tab comes back', await page.locator('.sk-lib-card').count() === 19);

// --- delete, confirmed against the database
const doomed = await page.locator('.sk-lib-title').first().innerText();
await page.locator('.sk-lib-dots').first().click();
check('the ⋯ menu opens', await page.locator('.sk-lib-menu').isVisible());
await page.locator('.sk-lib-menu-danger').click();
check('delete asks first', await page.locator('[role="alertdialog"]').isVisible());
check('the dialog names the story', (await page.locator('#sk-lib-modal-title').innerText()).includes(doomed));
await page.screenshot({ path: SHOTS + '/library-delete-confirm.png' });

// Cancelling must not delete anything.
await page.locator('.sk-lib-modal-actions button', { hasText: 'Keep it' }).click();
await page.waitForTimeout(400);
check('cancelling keeps the story', (await rows()).length === 19);

await page.locator('.sk-lib-dots').first().click();
await page.locator('.sk-lib-menu-danger').click();
await page.locator('.sk-lib-danger-btn').click();
await page.waitForFunction(() => document.querySelectorAll('.sk-lib-card').length === 18);
check('deleting removes the card', await page.locator('.sk-lib-card').count() === 18);
const afterDelete = await rows();
check('deleting removes the ROW, not just the card', afterDelete.length === 18);
check('it deleted the story it named', !afterDelete.some(r => r.title === doomed));
check('capacity meter follows the delete', (await page.locator('.sk-lib-cap-row').innerText()).includes('18 of 20 saved'));

// --- opening a story by id
const target = afterDelete[0];
check('the story about to be opened is unread', target.opened === false);
await page.locator('.sk-lib-open').first().click();
await page.waitForURL('**/create**');
await page.waitForSelector('.story-reader-frame, [class*="story-reader"]', { timeout: 8000 }).catch(() => {});
const readerText = await page.locator('body').innerText();
check('the reader opens the story that was tapped', readerText.includes(target.title), `looked for "${target.title}"`);
// Stripped by a router.replace once the story is in hand, so this needs a wait, not a read - the
// URL is still ?story=<id> for the round trip that fetches the row.
await page.waitForFunction(() => window.location.search === '', null, { timeout: 5000 }).catch(() => {});
check('the story id is stripped from the URL', new URL(page.url()).search === '', page.url());
await page.waitForTimeout(900);
const opened = (await rows()).find(r => r.id === target.id);
check('opening from the Library marks the row opened', opened?.opened === true);
await page.screenshot({ path: SHOTS + '/library-opened-story.png', fullPage: true });

// --- deleting the open story clears Home's Continue card
{
  // The story opened above is now in the local slot, stamped with its row id. Delete it from the
  // Library and Home must stop offering to resume it - the failure this catches is a Continue card
  // for a story that exists nowhere.
  await go(page, 'http://localhost:3000/library');
  await page.waitForSelector('.sk-lib-card');
  const slotBefore = await page.evaluate(() => window.localStorage.getItem('storykins:continue-story'));
  check('the opened story is in the local slot with its row id',
    Boolean(slotBefore) && JSON.parse(slotBefore).id === target.id, String(slotBefore).slice(0, 120));

  const cards = page.locator('.sk-lib-card');
  const n = await cards.count();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    if ((await cards.nth(i).locator('.sk-lib-title').innerText()) === target.title) { idx = i; break; }
  }
  check('the opened story is still on the shelf', idx >= 0);
  await cards.nth(idx).locator('.sk-lib-dots').click();
  await cards.nth(idx).locator('.sk-lib-menu-danger').click();
  await page.locator('.sk-lib-danger-btn').click();
  await page.waitForFunction(c => document.querySelectorAll('.sk-lib-card').length === c, n - 1);
  const slotAfter = await page.evaluate(() => window.localStorage.getItem('storykins:continue-story'));
  check('deleting the story clears its Continue card', slotAfter === null, String(slotAfter).slice(0, 120));
}

// --- ?new=1 deep link
await go(page, 'http://localhost:3000/create?new=1');
await page.waitForTimeout(400);
check('?new=1 opens setup', (await page.locator('body').innerText()).toLowerCase().includes('genre')
  || await page.locator('.sk-deck-go, .sk-setup-frame, [class*="sk-deck"]').count() > 0);
check('?new=1 is stripped from the URL', new URL(page.url()).search === '');

// --- a story that no longer exists
await go(page, `http://localhost:3000/create?story=${target.id}`);
await page.waitForTimeout(1200);
// `target` was just deleted, so this is the real "someone bookmarked a story that's gone" case.
check('a deleted story id lands on Home with a reason', await page.locator('.sk-deeplink-error').isVisible());
check('the failed open leaves a way out (no trapped overlay)', await page.locator('.sk-opening').count() === 0);

// --- tablet sidebar layout
const tablet = await browser.newContext({ viewport: IPAD, deviceScaleFactor: 2 });
await tablet.addCookies(sessionCookies(session, projectRef));
const tabletPage = watch(await tablet.newPage());
await go(tabletPage, 'http://localhost:3000/library');
await tabletPage.waitForSelector('.sk-lib-card');
check('tablet renders the sidebar nav with Library', await tabletPage.locator('.sk-appnav-tablet button[aria-label="Library"]').count() === 1);
check('tablet grid goes wider than two columns',
  new Set(await tabletPage.locator('.sk-lib-card').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().left)))).size > 2);
await tabletPage.screenshot({ path: SHOTS + '/library-tablet-light.png', fullPage: true });
await tabletPage.emulateMedia({ colorScheme: 'dark' });
await tabletPage.screenshot({ path: SHOTS + '/library-tablet-dark.png', fullPage: true });
await tablet.close();

check('no console errors anywhere in the run', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '));

await ctx.close();
await browser.close();
await wipe();

console.log(`\n${pass}/${pass + fail} passed`);
console.log(`screenshots: ${SHOTS}`);
process.exit(fail ? 1 : 0);

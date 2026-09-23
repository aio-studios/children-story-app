// End-to-end verification of the end-of-story sign-in sheet + the Library's honesty line
// (#92, Step 7).
//
// Entirely a GUEST suite, on purpose: the sheet only ever shows to someone without an account, so
// there is nothing here that needs Supabase, a seeded row, or a generated story. It drives the real
// reader and crosses the real completion threshold - the one in lib/storyHistory.ts, not a copy.
//
// NOT destructive. Touches only this browser profile's localStorage.
//
//   npm run dev  &&  node scripts/verify-signin-sheet.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = REPO + '/.playwright-shots';
const BASE = 'http://localhost:3000';

const SNOOZE_KEY = 'storykins:signin-snoozed-until';
const SLOT_KEY = 'storykins:continue-story';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Finishing needs 30s of banked reading time (lib/signInPrompt.ts), so the slot starts just short of
// it and the reader supplies the rest itself - the point being to exercise the real threshold rather
// than assert on a pre-cooked "complete" flag. The floor is deliberately NOT the Continue card's
// 2-min/10-min rule: that one is tuned to fail safe by keeping a card around, which here would mean
// never asking at all. A quick story reads aloud in 60-90s and the clock pauses on tab-hide, so the
// old bar was effectively unreachable in real use (UAT 2026-09-23).
const ALMOST_DONE = {
  title: 'The Kindness Dragon',
  story: Array.from({ length: 14 }, (_, i) =>
    `Paragraph ${i + 1}. Ember the dragon warmed the mountain, and the village below slept soundly under a sky full of quiet stars.`).join('\n\n'),
  genre: { type: 'preset', genreId: 'fantasy' },
  character: { type: 'preset', characterId: 'ember' },
  length: 'quick',
  readingLevel: 'early-reader',
  tone: 'playful',
  lesson: { type: 'preset', lessonId: 'kindness' },
  progress: 0.985,
  timeSpent: 28_000,
  savedAt: Date.now(),
};

let pass = 0, fail = 0;
const check = (n, c, extra = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + ' ' + extra)); };

fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
const browser = await chromium.launch();

const IPHONE = { width: 390, height: 844 };  // iPhone 12 Pro
const IPAD = { width: 834, height: 1112 };

const consoleErrors = [];
function watch(page) {
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
  return page;
}

// The dev overlay (<nextjs-portal>) sits above the whole page and swallows clicks. Hidden rather
// than force-clicked, so a click that genuinely misses its target still fails.
const HIDE_DEV_OVERLAY = 'nextjs-portal { display: none !important; }';

// Seeds the continue slot, then opens the story through Home's Continue card - the real entry
// point, not a URL that skips the hydration path the ask hooks into.
async function openAlmostFinishedStory(page, { slot = ALMOST_DONE, snooze = null } = {}) {
  await page.goto(BASE + '/create', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([slotKey, slotVal, snoozeKey, snoozeVal]) => {
    localStorage.setItem(slotKey, slotVal);
    localStorage.setItem('storykins:has-created', '1');
    if (snoozeVal === null) localStorage.removeItem(snoozeKey);
    else localStorage.setItem(snoozeKey, snoozeVal);
  }, [SLOT_KEY, JSON.stringify({ ...slot, savedAt: Date.now() }), SNOOZE_KEY, snooze]);
  await page.goto(BASE + '/create', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.locator('.story-reader-story').waitFor({ state: 'visible', timeout: 15_000 });
}

// Reads to the end for real. Two things make this fiddly and both are the reader's actual
// behaviour, not test scaffolding: progress writes are throttled to 500ms, and scrolling to a
// position the page is already at fires no scroll event at all. So the nudges have to be spaced
// AND have to move. Without that the completion is only noticed on the reader's own 15s tick,
// which is correct behaviour but a slow thing to wait on ten times over.
async function readToTheEnd(page) {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollBy(0, -8));
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
}

const sheet = page => page.locator('.sk-sheet');
// Present-or-not, without Playwright's 30s auto-wait quietly turning a "never showed up" into a
// pass ten seconds later. Every assertion below resolves in about a second either way.
async function sheetShows(page, timeout = 4000) {
  return sheet(page).waitFor({ state: 'visible', timeout }).then(() => true, () => false);
}
const snoozeValue = page => page.evaluate(k => localStorage.getItem(k), SNOOZE_KEY);

// ------------------------------------------------------- the ask appears ----
console.log('\nTHE ASK');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const page = watch(await ctx.newPage());

  await openAlmostFinishedStory(page);
  check('sheet is absent while the story is still being read', await sheet(page).count() === 0);

  await readToTheEnd(page);
  check('sheet appears once the story is finished', await sheetShows(page));
  check('it asks the right question', (await page.locator('.sk-sheet-title').textContent())?.includes('Keep this story?'));
  check('it wraps the shared sign-in form', await page.locator('.sk-sheet #sk-signin-email').count() === 1);
  check('the email field is NOT autofocused over the story',
    await page.evaluate(() => document.activeElement?.id !== 'sk-signin-email'));
  check('focus moved into the sheet', await page.evaluate(() => !!document.activeElement?.closest?.('.sk-sheet')));
  check('it is a modal dialog', await sheet(page).getAttribute('aria-modal') === 'true');
  check('the story behind it cannot scroll', await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden'));
  check('nothing is snoozed yet', await snoozeValue(page) === null);
  await page.screenshot({ path: SHOTS + '/step7-sheet-iphone-light.png' });

  // Escape is one of three exits and must cost exactly what "Not now" costs.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Escape closes it', await sheet(page).count() === 0);
  check('Escape snoozes the ask like "Not now" does', await snoozeValue(page) !== null);
  check('the story scrolls again afterwards', await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'));

  const until = Number(await snoozeValue(page));
  check('the snooze is a week, not forever', Math.abs(until - (Date.now() + WEEK_MS)) < 60_000, `got ${until - Date.now()}ms`);
  await ctx.close();
}

// ------------------------------------------------------------ the snooze ----
console.log('\nTHE SNOOZE');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const page = watch(await ctx.newPage());

  // A live snooze is the whole point of the feature: finish another story, stay quiet.
  await openAlmostFinishedStory(page, { snooze: String(Date.now() + WEEK_MS - 1000) });
  await readToTheEnd(page);
  check('a live snooze suppresses the ask', await sheet(page).count() === 0);

  // ...and it has to expire, or "snooze" is just "never again" wearing a hat.
  await openAlmostFinishedStory(page, { snooze: String(Date.now() - 1000) });
  await readToTheEnd(page);
  check('an expired snooze lets it ask again', await sheetShows(page));

  // "Not now" is the labelled exit; it must snooze.
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.waitForTimeout(300);
  check('"Not now" closes the sheet', await sheet(page).count() === 0);
  check('"Not now" snoozes', Number(await snoozeValue(page)) > Date.now());

  // A garbled value must not mute the ask forever - it means "we know nothing", not "stay quiet".
  await openAlmostFinishedStory(page, { snooze: 'not-a-number' });
  await readToTheEnd(page);
  check('a garbled snooze value is ignored, not obeyed', await sheetShows(page));

  // A stamp beyond the window itself can only come from a clock that later moved backwards.
  // Expiring it beats silencing the sheet for years on a device with the wrong date.
  await openAlmostFinishedStory(page, { snooze: String(Date.now() + WEEK_MS * 500) });
  await readToTheEnd(page);
  check('a far-future stamp (clock skew) is treated as expired', await sheetShows(page));
  await ctx.close();
}

// ----------------------------------------------------- who does NOT get it ----
console.log('\nWHO DOES NOT GET ASKED');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const page = watch(await ctx.newPage());

  // NOT TESTED HERE, deliberately: "opening an already-finished story must not pop the sheet".
  // The guard for it is in openStoryInReader, but a guest cannot reach that state - Home hides the
  // Continue card for a finished story (isContinueComplete), and the Library needs an account, at
  // which point the ask is off anyway. Trying to drive it here just hangs waiting for a Continue
  // button that is correctly absent. The guard stays because the rule should hold on every path,
  // including the signed-in one Step 11 will open up.

  // Half-read is half-read, however long they have had it open.
  await openAlmostFinishedStory(page, { slot: { ...ALMOST_DONE, progress: 0.4, timeSpent: 600_000 } });
  await page.waitForTimeout(2500);
  check('plenty of reading time but not at the end: no ask', await sheet(page).count() === 0);
  check('...and Home is never where the sheet lands', await (async () => {
    await page.goto(BASE + '/create', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    return await sheet(page).count() === 0;
  })());

  // Scrolled to the bottom in four seconds flat is a skim, not a read. This is the same rule that
  // stops Home retiring a Continue card too early, reused rather than re-guessed.
  await openAlmostFinishedStory(page, { slot: { ...ALMOST_DONE, progress: 0, timeSpent: 0 } });
  await readToTheEnd(page);
  check('fast-scrolled to the bottom with no time spent: no ask', await sheet(page).count() === 0);

  // The floor has to bite just below itself, or it is decoration. readToTheEnd banks ~5s, so a slot
  // starting at 20s lands around 25s - at the end of the story but still short of the 30s floor.
  await openAlmostFinishedStory(page, { slot: { ...ALMOST_DONE, progress: 0.985, timeSpent: 20_000 } });
  await readToTheEnd(page);
  check('at the end but just under the 30s floor: no ask', await sheet(page).count() === 0);
  await ctx.close();
}

// ---------------------------------------------------- the standing honesty ----
console.log('\nTHE HONESTY LINE');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const page = watch(await ctx.newPage());
  await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
  const line = page.locator('.sk-lib-local');
  await line.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  check('a guest sees "Saved on this phone only" in the Library', await line.isVisible());
  check('it sits above the tabs, not buried in the guest pane', await page.evaluate(() => {
    const l = document.querySelector('.sk-lib-local'), seg = document.querySelector('.sk-lib-seg');
    return !!l && !!seg && l.compareDocumentPosition(seg) === Node.DOCUMENT_POSITION_FOLLOWING;
  }));
  check('it survives switching to Favourites (it is a screen-level status)', await (async () => {
    await page.getByRole('tab', { name: /favourites/i }).click();
    await page.waitForTimeout(200);
    return line.isVisible();
  })());
  await page.screenshot({ path: SHOTS + '/step7-library-guest-iphone-light.png', fullPage: true });
  await ctx.close();
}

// ------------------------------------------------------- the deleted harness ----
console.log('\nTHE RETIRED HARNESS');
{
  const ctx = await browser.newContext({ viewport: IPHONE });
  const page = watch(await ctx.newPage());
  const res = await page.goto(BASE + '/auth/test', { waitUntil: 'domcontentloaded' });
  check('/auth/test is gone (404), not still sending magic links', res?.status() === 404, `got ${res?.status()}`);
  await ctx.close();
}

// --------------------------------------------------------------- dark + iPad ----
console.log('\nDARK MODE AND TABLET');
for (const [name, viewport, scheme] of [
  ['iphone-dark', IPHONE, 'dark'],
  ['ipad-light', IPAD, 'light'],
  ['ipad-dark', IPAD, 'dark'],
]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const page = watch(await ctx.newPage());
  await openAlmostFinishedStory(page);
  await readToTheEnd(page);
  const shown = await sheetShows(page);
  check(`sheet renders at ${name}`, shown);
  if (shown) {
    // A sheet taller than the viewport would put "Not now" off-screen with no way to scroll to it,
    // since the body is locked - the exact trap that made the iPhone button-sizing bug (#20) real.
    check(`"Not now" is reachable at ${name}`, await page.getByRole('button', { name: 'Not now' }).isVisible());
    const box = await sheet(page).boundingBox();
    check(`sheet fits the viewport at ${name}`, box.height <= viewport.height, `${box?.height}px in ${viewport.height}px`);
  }
  await page.screenshot({ path: `${SHOTS}/step7-sheet-${name}.png` });

  await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
  await page.screenshot({ path: `${SHOTS}/step7-library-${name}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();

// The 404 the harness check deliberately provokes is the one expected error in this run.
const noisy = consoleErrors.filter(e => !/favicon|Download the React DevTools|status of 404/i.test(e));
check('no console errors', noisy.length === 0, noisy.slice(0, 3).join(' | '));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

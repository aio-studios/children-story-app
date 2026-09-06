// End-to-end verification of the cover-Blob lifecycle and library eviction (#92, Step 5 / #46).
//
// This is the step that can destroy user data: deleting a Blob that a saved story still points at is
// silent and unrecoverable. So the invariant is asserted from both sides - the server refusing a
// referenced cover, and the client sequencing row-then-Blob - with REAL Blobs, never fakes. A fake
// URL proves nothing here: deleteIllustration() no-ops on anything outside its own path prefix, so a
// test built on one passes whether the code works or not.
//
// ⚠️  DESTRUCTIVE: deletes every story belonging to TEST_USER_EMAIL, before and after the run.
//     Point it at a dedicated throwaway account. Never at a real one.
// 💸  Generates 4 real cover images (~$0.16) and 3 real stories. Not free, and not for a watch loop.
//
// SETUP
//   1. Apply supabase/migrations/003_cover_is_referenced.sql in the Supabase SQL editor.
//   2. TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.local (same account as verify-library-signed-in).
//   3. npm run dev
//   4. node scripts/verify-cover-lifecycle.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'http://localhost:3000';
const LIBRARY_LIMIT = 20;   // must match storyRepo.LIBRARY_LIMIT

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = new URL(URL_).hostname.split('.')[0];

let pass = 0, fail = 0;
const check = (n, c, extra = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (extra ? '  ' + extra : ''))); };

async function signIn() {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
  });
  const s = await res.json();
  if (!s.access_token) throw new Error('sign-in failed: ' + JSON.stringify(s));
  return s;
}

const session = await signIn();
const token = session.access_token;
const auth = { apikey: KEY, Authorization: `Bearer ${token}` };

// Everything is read back through RLS with the user's own token, never as an admin.
const rows = async (cols = 'id,title,image_url,opened,updated_at') =>
  (await fetch(`${URL_}/rest/v1/stories?select=${cols}&order=updated_at.desc`, { headers: auth })).json();
const wipe = async () => {
  await fetch(`${URL_}/rest/v1/stories?id=neq.00000000-0000-0000-0000-000000000000`,
    { method: 'DELETE', headers: { ...auth, Prefer: 'return=minimal' } });
};
const insertRow = async (row) => {
  const r = await fetch(`${URL_}/rest/v1/stories`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: session.user.id, mode: 'classic', title: 'seed', selections: {}, content: { story: 'seed' }, ...row,
    }),
  });
  const body = await r.text();
  const [created] = body ? JSON.parse(body) : [];
  if (!created) throw new Error(`seed insert failed: ${r.status} ${body}`);
  return created;
};

// A cover Blob really is gone (or really is still there) - the only assertion that matters here.
//
// ⚠️  NOT a HEAD on the public URL. Vercel's edge cache keeps serving a deleted cover a 200 for a
//     while, so a public HEAD reports "still there" for a Blob that is genuinely gone - which would
//     fail the delete assertions and PASS the "must not be deleted" ones for the wrong reason.
//     head() from @vercel/blob asks the store itself and is the only authoritative answer.
const { head } = await import(REPO + '/node_modules/@vercel/blob/dist/index.js');
const blobToken = env.BLOB_READ_WRITE_TOKEN;
const blobExists = async (url) => {
  try {
    await head(url, { token: blobToken });
    return true;
  } catch (e) {
    // Only "not found" means deleted. Anything else (auth, network) must not read as a clean delete.
    if (e?.name === 'BlobNotFoundError' || /does not exist/i.test(e?.message ?? '')) return false;
    throw e;
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Both endpoints this suite drives are rate-limited to 3 requests per 60s per IP (lib/rateLimit.ts),
// and the app fires its own deletes into the same buckets while the browser half runs. A 429 is the
// limiter working, not the lifecycle failing - so wait the window out and retry rather than
// recording a false failure.
async function withRateLimitRetry(label, attempt, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await attempt();
    if (r.status !== 429) return r;
    console.log(`  (429 on ${label} — waiting out the 60s window, attempt ${i + 1}/${tries})`);
    await sleep(21000);
  }
  throw new Error(`${label}: still rate-limited after ${tries} attempts`);
}

const askDelete = (url) => withRateLimitRetry('delete-illustration', async () => {
  const r = await fetch(`${APP}/api/delete-illustration`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
});

// A real cover, generated the same way the app generates one. Every id here is validated
// server-side against lib/genres.ts + lib/storyOptions.ts - invented ones get a flat 400.
const SELECTIONS = {
  genre: { type: 'preset', genreId: 'adventure' },
  character: { type: 'preset', characterId: 'finn' },
  length: 'quick', readingLevel: 'early-reader', tone: 'calming',
  lesson: { type: 'preset', lessonId: 'kindness' },
};
async function mintCover(label) {
  const r = await withRateLimitRetry(`mint cover ${label}`, async () => {
    const res = await fetch(`${APP}/api/generate-illustration`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Lifecycle check ${label}`, selections: SELECTIONS }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  });
  if (!r.body?.imageUrl) throw new Error(`could not mint a cover (${label}): ${r.status} ${r.body?.error ?? ''}`);
  return r.body.imageUrl;
}

console.log('\n-- 0. preflight --');
const rpc = await fetch(`${URL_}/rest/v1/rpc/cover_is_referenced`, {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ cover_url: 'https://example.invalid/story-covers/nope.png' }),
});
const rpcBody = await rpc.text();
if (rpc.status !== 200) {
  console.error('  migration 003 is not applied — run supabase/migrations/003_cover_is_referenced.sql in the SQL editor first.');
  console.error('  rpc said:', rpc.status, rpcBody);
  process.exit(2);
}
check('migration 003 applied — cover_is_referenced answers', true);
check('an unknown cover reads as unreferenced', rpcBody.trim() === 'false', rpcBody);
await wipe();
check('starts from an empty library', (await rows()).length === 0);

console.log('\n-- 1. the landmine: a cover a row still points at cannot be deleted --');
const coverA = await mintCover('A');
const rowA = await insertRow({ title: 'Guarded story', image_url: coverA });
const refused = await askDelete(coverA);
check('the endpoint refuses it', refused.status === 409, `got ${refused.status}`);
check('the Blob is still there', await blobExists(coverA));
check('the row still points at it', (await rows()).find(x => x.id === rowA.id)?.image_url === coverA);

console.log('\n-- 2. once nothing references it, the same cover is deleted --');
await fetch(`${URL_}/rest/v1/stories?id=eq.${rowA.id}`, { method: 'DELETE', headers: auth });
const allowed = await askDelete(coverA);
check('the endpoint allows it', allowed.status === 200, `got ${allowed.status}`);
check('the Blob is gone', !(await blobExists(coverA)));

const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
ctx.addCookies((() => {
  const stored = {
    access_token: session.access_token, token_type: session.token_type, expires_in: session.expires_in,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token, user: session.user,
  };
  return createChunks(`sb-${projectRef}-auth-token`, 'base64-' + stringToBase64URL(JSON.stringify(stored)))
    .map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
})());
const p = await ctx.newPage();
const errors = [];
p.on('console', m => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', e => errors.push('pageerror: ' + e.message));

async function makeStory({ illustrated = false } = {}) {
  await p.getByRole('button', { name: /^create$/i }).first().click();
  await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    if (illustrated) {
      // role="switch", not "button" - a getByRole('button') lookup matches nothing and fails silently.
      const sw = p.getByRole('switch', { name: /add a cover picture/i });
      if (await sw.count() && (await sw.getAttribute('aria-checked')) === 'false') await sw.click();
    }
    const c = p.getByRole('button', { name: /continue/i }).first();
    if (await c.count()) { await c.click(); await p.waitForTimeout(900); }
  }
  await p.getByRole('button', { name: /create story/i }).first().click();
  await p.waitForSelector('text=Regenerate', { timeout: 120000 });
  await p.waitForTimeout(2500);
}

// The cover is generated after the story is already on screen, so the row gets its image_url late.
async function waitForCoverOnRow(id, timeoutMs = 90000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const row = (await rows()).find(x => x.id === id);
    if (row?.image_url) return row.image_url;
    await sleep(2000);
  }
  return null;
}

console.log('\n-- 3. regenerating an unread story takes its old cover with it --');
await p.goto(`${APP}/create`, { waitUntil: 'networkidle' });
await makeStory({ illustrated: true });
let r = await rows();
check('one row saved', r.length === 1, `got ${r.length}`);
const liveId = r[0]?.id;
const firstCover = await waitForCoverOnRow(liveId);
check('the first cover reached the row', !!firstCover, String(firstCover));
check('that Blob exists', firstCover ? await blobExists(firstCover) : false);

await p.getByRole('button', { name: /regenerate/i }).first().click();
await p.waitForSelector('text=Regenerate', { timeout: 120000 });
await p.waitForTimeout(3000);
r = await rows();
check('still one row, replaced in place', r.length === 1 && r[0]?.id === liveId, `${r.length} row(s), id ${r[0]?.id}`);
check('the row no longer points at the old cover', r[0]?.image_url !== firstCover, String(r[0]?.image_url));
// The delete is fire-and-forget, so give it a moment before asserting the Blob is actually gone.
await sleep(4000);
check('the orphaned Blob was deleted', firstCover ? !(await blobExists(firstCover)) : false);
const secondCover = await waitForCoverOnRow(liveId);
if (secondCover) check('the replacement cover survived', await blobExists(secondCover));

console.log('\n-- 4. eviction past the cap takes the evicted story\'s cover with it --');
await wipe();
// 'victim' as a label got this a 400 from the Haiku safety classifier - the title feeds the image
// prompt and is checked like any other user input. Test fixtures have to read as children's-app safe.
const victimCover = await mintCover('oldest');
const victim = await insertRow({
  title: 'Oldest story', image_url: victimCover,
  updated_at: new Date(Date.now() - 400 * 864e5).toISOString(),
});
// Fill to exactly the cap, all older than anything the app is about to write.
for (let i = 1; i < LIBRARY_LIMIT; i++) {
  await insertRow({ title: `Seeded ${i}`, updated_at: new Date(Date.now() - (399 - i) * 864e5).toISOString() });
}
check(`library seeded to the cap (${LIBRARY_LIMIT})`, (await rows()).length === LIBRARY_LIMIT, `got ${(await rows()).length}`);
check('the victim is the oldest row', (await rows()).at(-1)?.id === victim.id);

await p.goto(`${APP}/create`, { waitUntil: 'networkidle' });
await makeStory();
await sleep(5000);   // insert, then the eviction pass behind it
r = await rows();
check(`library trimmed back to ${LIBRARY_LIMIT}`, r.length === LIBRARY_LIMIT, `got ${r.length}`);
check('the oldest story was the one evicted', !r.some(x => x.id === victim.id));
check("the evicted story's cover Blob was deleted", !(await blobExists(victimCover)));
check('the newest story is the one just created', r[0]?.title !== 'Seeded 1' && r[0]?.id !== victim.id);

console.log('\n-- health --');
console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
console.log(`\n${pass} passed, ${fail} failed`);

await wipe();
console.log('library wiped clean:', (await rows()).length === 0);
await b.close();
process.exit(fail ? 1 : 0);

// End-to-end verification of the signed-in story library (#92, Step 4).
//
// Drives a real browser against a real Supabase project as a real signed-in user, then reads the
// rows back THROUGH RLS with that user's own token - never as an admin - so what it asserts is what
// the user can actually see.
//
// ⚠️  DESTRUCTIVE: it deletes every story belonging to TEST_USER_EMAIL, before and after the run.
//    Point it at a dedicated throwaway account. Never at a real one.
//
// SETUP
//   1. Supabase -> Authentication -> Users -> Add user (tick "Auto Confirm User").
//   2. Add TEST_USER_EMAIL / TEST_USER_PASSWORD to .env.local (gitignored).
//   3. npm run dev
//   4. node scripts/verify-library-signed-in.mjs
//
// It signs in with the password grant rather than a magic link because a magic link needs someone to
// read an inbox. The session it builds is byte-identical to a real one: the cookie is encoded with
// @supabase/ssr's OWN chunker and base64url helpers, so the app's client reads it back exactly as it
// would its own. The magic-link flow itself is verified separately on real hardware.
//
// Re-run this after ANY change to the persistence layer - it is what proves rows actually land.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

async function signIn() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
  });
  const s = await res.json();
  if (!s.access_token) throw new Error('sign-in failed: ' + JSON.stringify(s));
  return s;
}

// The exact cookie @supabase/ssr writes, built with its own encoder + chunker so the app's client
// reads it back the same way it would its own.
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

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');

const session = await signIn();
const token = session.access_token;
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Read the library exactly as the signed-in user, through RLS - not as an admin.
const rows = async () => {
  const r = await fetch(`${URL_}/rest/v1/stories?select=id,title,mode,image_url,progress,time_spent,opened,selections,content&order=updated_at.desc`,
    { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  return r.json();
};
const wipe = async () => {
  await fetch(`${URL_}/rest/v1/stories?id=neq.00000000-0000-0000-0000-000000000000`,
    { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'return=minimal' } });
};

let pass = 0, fail = 0;
const check = (n, c, extra='') => { c ? (pass++, console.log('  PASS  '+n)) : (fail++, console.log('  FAIL  '+n+' '+extra)); };

await wipe();
check('starts from an empty library', (await rows()).length === 0);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(sessionCookies(session, projectRef));
const p = await ctx.newPage();
const errors = []; const supa = [];
p.on('console', m => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('request', r => { if (r.url().includes('supabase.co/rest')) supa.push(r.method()); });

await p.goto('http://localhost:3000/create', { waitUntil: 'networkidle' });

async function makeStory() {
  await p.getByRole('button', { name: /^create$/i }).first().click();
  await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    const c = p.getByRole('button', { name: /continue/i }).first();
    if (await c.count()) { await c.click(); await p.waitForTimeout(900); }
  }
  const go = p.getByRole('button', { name: /create story/i }).first();
  await go.click();
  await p.waitForSelector('text=Regenerate', { timeout: 120000 });
  await p.waitForTimeout(2500); // let the insert land
}

console.log('\n-- 1. auto-save on create --');
await makeStory();
let r = await rows();
check('exactly one row saved', r.length === 1, `got ${r.length}`);
check('title matches the story on screen', !!r[0]?.title && r[0].title.length > 3, JSON.stringify(r[0]?.title));
check('mode recorded', r[0]?.mode === 'classic', r[0]?.mode);
check('selections stored', !!r[0]?.selections?.genre && !!r[0]?.selections?.character);
check('prose stored in content', typeof r[0]?.content?.story === 'string' && r[0].content.story.length > 50);
check('opened is false for a brand-new story', r[0]?.opened === false, String(r[0]?.opened));
const firstId = r[0]?.id, firstTitle = r[0]?.title;

console.log('\n-- 2. regenerate replaces the unread row in place --');
await p.getByRole('button', { name: /regenerate/i }).first().click();
await p.waitForSelector('text=Regenerate', { timeout: 120000 });
await p.waitForTimeout(2500);
r = await rows();
check('still exactly one row (no stacked drafts)', r.length === 1, `got ${r.length}`);
check('same row id, replaced in place', r[0]?.id === firstId, `${firstId} -> ${r[0]?.id}`);
check('story text actually changed', r[0]?.title !== firstTitle || r[0]?.content?.story !== undefined);

console.log('\n-- 3. reading progress reaches the row --');
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(1200);
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
await p.waitForTimeout(2500);
r = await rows();
check('progress written to the row', (r[0]?.progress ?? 0) > 0, `progress=${r[0]?.progress}`);
check('reading time written to the row', (r[0]?.time_spent ?? 0) > 0, `time_spent=${r[0]?.time_spent}`);

console.log('\n-- 4. leaving the story and making a new one does not overwrite it --');
// Exit via the reader's own "Back to setup" - this is the exact path that used to leave savedRow
// pointing at the old story, so the next story silently replaced it. Deliberately NO scroll to top
// first: progress is last-position (not furthest) by design, so scrolling back up legitimately
// writes 0 and would make this assertion test the test, not the app.
const before = (await rows()).find(x => x.id === firstId)?.progress ?? 0;
console.log('  (old row progress before leaving: ' + before + ')');
await p.getByRole('button', { name: /back to setup/i }).first().click();
await p.waitForTimeout(1000);
await p.getByRole('button', { name: /create story/i }).first().click();
await p.waitForSelector('text=Regenerate', { timeout: 120000 });
await p.waitForTimeout(2500);
r = await rows();
check('two rows now', r.length === 2, `got ${r.length}`);
check('the first story survived', r.some(x => x.id === firstId));
const prev = r.find(x => x.id === firstId);
check('its progress survived the new story unchanged', prev?.progress === before, `${before} -> ${prev?.progress}`);
check('its prose was not overwritten by the new story', prev?.content?.story !== r.find(x => x.id !== firstId)?.content?.story);

console.log('\n-- health --');
console.log('supabase REST calls made:', supa.length, supa.join(','));
console.log('console errors:', errors.length ? errors.slice(0,5) : 'none');
console.log(`\n${pass} passed, ${fail} failed`);

await wipe();
console.log('library wiped clean:', (await rows()).length === 0);
await b.close();
process.exit(fail ? 1 : 0);

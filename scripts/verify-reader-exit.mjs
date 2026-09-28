// Leaving the reader mid-story must record where the reader actually was (2026-09-26 review).
//
// Two bugs, same exit: the reader's unmount save measured scroll position AFTER Home had replaced it
// in the DOM, so every story left mid-read was saved as 100% "finished" locally; and the exit
// handlers cleared the library row before that save ran, so the database never got it at all. All
// six other gates passed with both live - none of them leave a reader partway through.
//
// DESTRUCTIVE: deletes every story belonging to TEST_USER_EMAIL. Throwaway account only. Free: the
// story is seeded, not generated.
//
//   npm run dev  &&  node scripts/verify-reader-exit.mjs


import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const { chromium } = await import(REPO + '/node_modules/playwright/index.mjs');
await wipe();
const row = await seed({ title: 'The Goodbye Save', genreId: 'fantasy' });
const long = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}: the dragon walked a little further along the winding path, humming.`).join('\n\n');
await fetch(`${URL_}/rest/v1/stories?id=eq.${row.id}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: { story: long } }) });
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies()); const p = await ctx.newPage();
await p.goto(APP + '/create', { waitUntil: 'networkidle' });
await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
await p.locator('.sk-drow', { has: p.locator('text=Your recent stories') }).getByText('The Goodbye Save').click();
await p.waitForTimeout(1500);
const scrollTo = f => p.evaluate(f => window.scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), f);
await scrollTo(0.2); await p.waitForTimeout(150);   // first save goes through (throttle opens)
await scrollTo(0.7); await p.waitForTimeout(100);   // inside the throttle window: only the unmount save can record it
await p.locator('[aria-label="Open menu"]').dispatchEvent('click');
await p.locator('nav[aria-label="Main menu"]').getByText('Home', { exact: true }).click();
await p.waitForTimeout(2500);
const local = await p.evaluate(() => JSON.parse(localStorage.getItem('storykins:continue-story') ?? 'null')?.progress);
const [r] = await (await fetch(`${URL_}/rest/v1/stories?id=eq.${row.id}&select=progress`, { headers: auth })).json();
const near = v => typeof v === 'number' && Math.abs(v - 0.7) < 0.05;
let fail = 0;
for (const [name, v] of [['the Continue card keeps the real position, not "finished"', local], ['the library row gets the final position', r?.progress]]) {
  if (near(v)) console.log('  PASS  ' + name);
  else { fail++; console.log(`  FAIL  ${name} (got ${v})`); }
}
console.log(`\n${2 - fail}/2 passed`);
await wipe(); await b.close();

process.exit(fail ? 1 : 0);

// Verifies the rate limiter counts a signed-in user per ACCOUNT and a guest per IP (#92 Step 10).
//
// Free: every request is deliberately invalid. The routes check the rate limit BEFORE validating the
// body, so an invalid request still spends one unit of budget and then gets a 400 - no AI is called.
// A 429 means "budget used up"; a 400 means "allowed through, then refused as invalid".
//
// Each run uses made-up IPs (x-forwarded-for, honoured by the local dev server) and resets the test
// user's own budgets first, so runs can go back to back.
//
//   npm run dev  &&  node scripts/verify-rate-limit-keys.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'http://localhost:3000';

const { createChunks } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/chunker.js');
const { stringToBase64URL } = await import(REPO + '/node_modules/@supabase/ssr/dist/module/utils/base64url.js');
const { Ratelimit } = await import(REPO + '/node_modules/@upstash/ratelimit/dist/index.js');
const { Redis } = await import(REPO + '/node_modules/@upstash/redis/nodejs.mjs');

const env = Object.fromEntries(fs.readFileSync(REPO + '/.env.local', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(URL_).hostname.split('.')[0];
const redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });

let pass = 0, fail = 0;
const check = (n, c, extra = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + ' ' + extra); }
};

const cookieHeader = (s) => createChunks(`sb-${ref}-auth-token`, 'base64-' + stringToBase64URL(JSON.stringify({
  access_token: s.access_token, token_type: s.token_type, expires_in: s.expires_in,
  expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in, refresh_token: s.refresh_token, user: s.user,
}))).map(c => `${c.name}=${c.value}`).join('; ');

const rand = () => Math.floor(Math.random() * 250) + 1;
const fakeIp = () => `10.${rand()}.${rand()}.${rand()}`;

// One deliberately invalid request; returns its status. 400 = allowed, 429 = limited.
async function hit(route, ip, cookie) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip };
  if (cookie) headers.Cookie = cookie;
  return (await fetch(`${APP}/api/${route}`, { method: 'POST', headers, body: '{}' })).status;
}
const hits = async (n, ...args) => { const out = []; for (let i = 0; i < n; i++) out.push(await hit(...args)); return out; };

const userA = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
})).json();
if (!userA.access_token) throw new Error('test user sign-in failed: ' + JSON.stringify(userA));
const anon = await (await fetch(`${URL_}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}',
})).json();
if (!anon.access_token) throw new Error('anonymous sign-up failed - is it on for the DEV project? ' + JSON.stringify(anon));

const A = cookieHeader(userA), ANON = cookieHeader(anon);
const home = fakeIp(), elsewhere = fakeIp(), other = fakeIp();

// Parent A's personal budgets persist for 60s, and a spent budget answers 429 exactly like a
// working ceiling would - so every check needs A to start fresh. Two layers hold that state:
// Redis, and an in-memory "already blocked" cache inside the running app (@upstash/ratelimit's
// ephemeral cache). A Redis reset can't reach the second one, so if A is mid-block from an earlier
// run, wait out the window instead (at most ~60s). Otherwise a Redis reset is enough.
const story = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '60 s'), prefix: 'ratelimit' });
const step = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, '60 s'), prefix: 'ratelimit:step' });
const aKeys = [[story, `user:${userA.user.id}`], [story, `illust:user:${userA.user.id}`], [step, `user:${userA.user.id}`]];
async function freshA() {
  let waitUntil = 0;
  for (const [limiter, id] of aKeys) {
    const { remaining, reset } = await limiter.getRemaining(id);
    if (remaining === 0) waitUntil = Math.max(waitUntil, reset);
  }
  if (waitUntil > Date.now()) {
    console.log(`  (waiting ${Math.ceil((waitUntil - Date.now()) / 1000)}s for the test user's budget from an earlier run to refill)`);
    await new Promise(r => setTimeout(r, waitUntil - Date.now() + 1500));
  }
  for (const [limiter, id] of aKeys) await limiter.resetUsedTokens(id);
}

try {
  console.log('\nTHE PER-CONNECTION CEILING STOPS THE MANY-ACCOUNTS TRICK');
  // We only have one real test account, so stand in for "lots of accounts on one connection" by
  // spending that connection's ceiling directly in Redis (same limiter config and key format as
  // lib/rateLimit.ts + the routes).
  const crowded = fakeIp();
  const ceiling = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'ratelimit:conn' });
  // freshA() BEFORE the pre-fill: it may wait up to a minute, and this limiter discounts uses from
  // the previous one-minute block, so a pre-fill made before the wait can partly age out.
  await freshA();
  for (let i = 0; i < 10; i++) {
    await ceiling.limit(`story:${crowded}`);
    await ceiling.limit(`illust:${crowded}`);
  }
  check('a signed-in parent with a FRESH budget is limited on a connection that already made 10 stories', (await hit('generate-story', crowded, A)) === 429);
  check('...and on one that already made 10 cover pictures', (await hit('generate-illustration', crowded, A)) === 429);
  check('a guest on that connection is unaffected by the signed-in ceiling', (await hit('generate-story', crowded)) === 400);
  // The two refused requests above spent one unit each of A's own budgets (own limit is checked
  // first), so start the per-account checks below from fresh again.
  await freshA();

  console.log('\nA SIGNED-IN PARENT HAS THEIR OWN BUDGET');
  const a = await hits(4, 'generate-story', home, A);
  check('parent A: 3 stories allowed, the 4th limited', a.join() === '400,400,400,429', a.join());
  check('a guest on the SAME home connection is not affected', (await hit('generate-story', home)) === 400);

  console.log('\nGUESTS STILL SHARE ONE BUDGET PER CONNECTION');
  const g = await hits(3, 'generate-story', home);
  check('the home connection runs out after 3 guest requests (incl. the one above)', g.join() === '400,400,429', g.join());
  check('parent A\'s budget follows the account, not the connection (still limited from elsewhere)', (await hit('generate-story', elsewhere, A)) === 429);

  console.log('\nANONYMOUS ACCOUNTS AND BAD COOKIES ARE TREATED AS GUESTS');
  check('an anonymous account on the used-up home connection is limited like a guest', (await hit('generate-story', home, ANON)) === 429);
  check('a garbage session cookie falls back to the connection (allowed on a fresh one)', (await hit('generate-story', other, `sb-${ref}-auth-token=garbage`)) === 400);

  console.log('\nTHE OTHER TWO ROUTES USE THE SAME RULE');
  // Each request from a DIFFERENT fresh IP. Under a per-IP rule every one of these would be allowed;
  // only a budget that follows the account can stop the 4th. (Same-IP requests can't tell the two
  // rules apart - Codex caught that in the first version of this test.)
  const ill = [];
  for (let i = 0; i < 4; i++) ill.push(await hit('generate-illustration', fakeIp(), A));
  check('cover pictures: parent A\'s budget follows the account across connections (3 allowed, 4th limited)', ill.join() === '400,400,400,429', ill.join());
  const steps = [];
  for (let i = 0; i < 16; i++) steps.push(await hit('story-step', fakeIp(), A));
  check('interactive steps: parent A\'s 15/min budget follows the account across connections', steps.slice(0, 15).every(c => c === 400) && steps[15] === 429, steps.join());

} finally {
  // The anonymous account was only ever a test prop - delete it rather than leave it on dev.
  await fetch(`${URL_}/rest/v1/rpc/delete_my_account`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${anon.access_token}`, 'Content-Type': 'application/json' }, body: '{}',
  });
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

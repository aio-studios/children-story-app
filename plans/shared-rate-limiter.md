# Shared Rate Limiter (Upstash Redis)

**Overall Progress:** `100%` — done, awaiting your UAT sign-off

## TLDR
Replace the in-memory per-IP rate limiter in `app/api/generate-story/route.ts` (resets per serverless instance, doesn't actually hold under real traffic) with an Upstash Redis-backed limiter shared across all instances. Closes issue #39 — an explicit blocker before paid AI illustrations (#38) can ship to anyone outside internal testing.

## Critical Decisions
- **Provisioning: Vercel Marketplace Upstash integration** — one-click from the Vercel dashboard, auto-injects `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` into Production/Preview; local dev needs a one-time `vercel env pull .env.local`. Same bill as hosting, no separate account.
- **Fail open** — if the Redis check itself errors or times out, allow the request through rather than blocking real users. A rare Redis blip shouldn't take down story generation.
- **Reusable module (`lib/rateLimit.ts`)**, not inline in the route — issue #39 explicitly frames this as required before the future image-generation endpoint ships, and that endpoint will need the identical limiter.
- **Limit values unchanged**: 3 requests / 60s, keyed by `x-forwarded-for` IP — this is an infra swap, not a policy change.
- **Scope**: only `app/api/generate-story/route.ts` exists today; no other routes to touch.

## Tasks

- [x] 🟩 **Step 0: Provision Upstash (you)**
  - [x] 🟩 Added the Upstash integration from the Vercel dashboard (Storage tab)
  - [x] 🟩 Confirmed env vars landed — actually `KV_REST_API_URL`/`KV_REST_API_TOKEN` (Vercel's "KV" naming for the same Marketplace Upstash integration), not the classic `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` assumed during planning — `lib/rateLimit.ts` updated to match
  - [x] 🟩 Ran `vercel env pull .env.local` locally, confirmed `ANTHROPIC_API_KEY` was preserved alongside the new vars

- [x] 🟩 **Step 1: Install dependencies**
  - [x] 🟩 `@upstash/redis` + `@upstash/ratelimit`

- [x] 🟩 **Step 2: Build `lib/rateLimit.ts`**
  - [x] 🟩 Upstash `Redis` client from env vars, `Ratelimit` instance (sliding window, 3/60s)
  - [x] 🟩 Exported `checkRateLimit(identifier: string): Promise<boolean>` (returns `true` if allowed) wrapping the Upstash call in try/catch — fail open on error, `console.error` so failures are visible in logs without breaking the request

- [x] 🟩 **Step 3: Wire into `app/api/generate-story/route.ts`**
  - [x] 🟩 Removed `requestTimestamps` Map + `isRateLimited()` + related constants
  - [x] 🟩 Calls `checkRateLimit(clientIp)` in its place, same 429 response on limit hit
  - [x] 🟩 `tsc --noEmit` clean

- [x] 🟩 **Step 4: Update docs**
  - [x] 🟩 `docs/architecture.md` — replaced the "known gap" note + updated the story-generation code-map diagram's `RateLimit` node
  - [ ] 🟥 `CHANGELOG.md` via `/document`

- [ ] 🟨 **Step 5: Testing & review**
  - [x] 🟩 Manual verification against real Upstash: 5 rapid requests → first 3 pass the gate (400 on empty body, i.e. rate limit not the blocker), 4th/5th get 429; waited 61s, 6th request passed the gate again (window reset confirmed)
  - [x] 🟩 Fail-open confirmed: swapped in a bad token, Upstash threw `WRONGPASS`, error caught/logged, request still proceeded past the rate-limit check instead of blocking or crashing. Credentials reverted after.
  - [x] 🟩 `/verify` — backend-only change, curl'd `/api/generate-story` directly per the skill's own guidance (no UI to drive). Real end-to-end generation confirmed working (HTTP 200, valid story) after the swap, clean server logs
  - [x] 🟩 `/code-review` (high effort) — 1 real finding: `vercel link`/`env pull` had auto-appended a blanket `.env*` rule to `.gitignore`, which would've silently swallowed future edits to the already-tracked `.env.example` template. Removed (existing `.env`/`.env.local`/`.env*.local` rules already cover real secrets)
  - [x] 🟩 `/security-review` — no HIGH/MEDIUM findings. No new attack surface (identifier unchanged from before), credentials from trusted env vars, no secret leakage in error logging (verified against the actual Upstash error text), fail-open tradeoff is a documented deliberate decision and falls under this review's rate-limiting/DoS exclusions
  - [x] 🟩 `/document` — CHANGELOG.md 2026-07-28 entry added (Changed + Fixed)

## Follow-up (not in this plan)
- When the image-generation endpoint (#38) is built, it should import `lib/rateLimit.ts` directly rather than duplicating limiter setup — likely with its own (probably lower) request budget given per-image cost.

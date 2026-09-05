# Accounts + Story Library — Implementation Plan

**Overall Progress:** `32%` — Steps 1–2 done; Step 3 verified **cross-browser** on desktop, pending a real-device test + the two-user RLS check

**Issue:** [#92](https://github.com/aio-studios/children-story-app/issues/92) (sub-issue A of epic [#23](https://github.com/aio-studios/children-story-app/issues/23))
**Design:** [docs/designs/library-accounts-directions.html](../docs/designs/library-accounts-directions.html) — Direction A, frames A1–A3
**Last updated:** 2026-09-04

## ▶ Resume point (2026-09-04, session 2)

**Branch:** `feat/92-accounts-auth-foundation` — 2 commits, **not pushed**, `main` untouched.
`13f1f7b` the foundation · `70c61ea` code-review fixes. Uncommitted: `supabase/migrations/`.

**Last session's blocker is cleared.** The Supabase project was in the Free-tier **7-day idle pause**,
exactly as suspected, and resuming it restored everything — no data lost, no schema rebuild needed.
`GET /api/cron/supabase-ping` → `{"ok":true}`.

**Trap worth remembering:** during a resume the API gateway comes back *before* Postgres does.
`/auth/v1/settings` returns healthy config and REST returns a clean `401`, while a table query still
404s with `PGRST205` "Could not find the table in the schema cache". That combination is
indistinguishable from a dropped table. It is not one — wait and re-poll. This cost a wrong
diagnosis mid-session. Written up in `supabase/migrations/README.md`.

**Schema now lives in the repo:** `supabase/migrations/001_stories.sql` + `002_updated_at_trigger.sql`,
both idempotent (`if not exists` / `drop policy if exists` / `create or replace`), so re-running them
against a healthy project is a no-op. Previously the schema existed only in this plan doc, which made
recovery a manual transcription job.

**Step 3 is now verified, including the case it was designed for.** Magic-link sign-in was tested
**cross-browser**: link requested in Safari, opened and verified in Chrome, session established in
Chrome. This empirically confirms the `pkce_`-prefixed `token_hash` is inert — the verifier cookie
lives only in the requesting browser, and verification succeeded without it. That was previously an
assumption read off the `auth-js` source. Same mechanism the cross-*device* phone test relies on.

Also confirmed this session: `proxy.ts` skipping `/auth/callback` did **not** break session cookies.
Proved with a throwaway route that set a cookie via `next/headers` `cookies()` and returned a
self-constructed `NextResponse.redirect` — `set-cookie` was present on the 307. Route was deleted.

**Next actions, in order:**
1. Add the preview URL to Supabase → Authentication → Redirect URLs. Open decision: paste the exact
   URL per deploy, or allowlist `https://children-story-app-*.vercel.app/auth/callback` once.
2. Push the branch → Vercel preview. This is also the real fix for the pause problem: the keep-alive
   cron only runs on a *deployed* app, so a local-only branch lets the project pause every 7 days.
3. **Phone test** on the preview — the cross-device case. The harness needs `?t=<AUTH_HARNESS_TOKEN>`;
   the token is set in Vercel's *preview* env.
4. **Two-user RLS check** — create the second user directly in Supabase (Auth → Users → Add user),
   no second inbox needed. Confirm user B sees zero of user A's rows.
5. Then Step 4 (persistence layer).

**Watch-item for the deployed preview (not an issue locally):** mail providers pre-fetch links to
scan them, and a magic link is single-use — a scanner can consume the token before the user clicks.
This *cannot* happen with `localhost` links (unreachable from Google's crawlers), so it did not affect
local testing, but it becomes live the moment the callback is on a public URL. Standard mitigation is
an interstitial "click to finish signing in" page, since scanners don't press buttons. Decide during
the phone test rather than pre-building it.

**Carry forward:** Step 5 is still the dangerous one (`discardCover()` deleting a saved story's
cover). Nothing in this session touched it.

## TLDR

Give Storykins an optional account and a place for stories to live. Today the app forgets you: one story in `localStorage`, gone when the browser clears. This adds guest-first magic-link sign-in (Supabase) and a Library holding the last 20 stories — plus the privacy protections that storing kid-adjacent data honestly requires.

Guests keep working exactly as today. Nothing is gated.

## Critical Decisions

- **Guest-first, sign-in optional** — a signup wall before any value is delivered kills the funnel; sign-in is offered to _save_, never to create.
- **Email magic link only** — no passwords to store or reset; built so other providers slot in later.
- **Two new routes only** (`/auth/callback`, `/library`) + a static `/privacy` — Home/setup/reader stay the state machine in [app/page.tsx](../app/page.tsx). A full route refactor while also adding auth is two hard things at once.
- **`jsonb` for story content, not normalized beat tables** — the classic|interactive discriminated union already exists in [lib/storyHistory.ts](../lib/storyHistory.ts); nothing queries _inside_ a beat, so joins would buy nothing. One row per story mirrors the existing TS type.
- **No `profiles` table** — `auth.users` is enough; [docs/architecture.md](../docs/architecture.md) already says don't build one without a real need.
- **Evict by `updated_at`, not `created_at`** — resuming a story bumps it, so an actively-read story is structurally never the oldest. Gets "never evict the in-progress story" for free, with no extra flag.
- **RLS everywhere, service-role never on user-facing paths** — the database itself refuses to return another family's rows even if a query is buggy.
- **Story UUIDs + a `useStory(id)` hook from day one** — makes `/story/[id]` sharing (#56) purely additive later, and matches the existing guidance to keep data logic out of page components for the future Expo port.
- **Cover deletion moves to story deletion** — see Step 5; the current "delete on slot overwrite" is actively dangerous once many stories exist.

## Schema

Applied as two separate migrations, in order. They are kept split rather than merged into one block
because 001 is already live — re-running a combined block fails with `42P07 relation already exists`
and rolls the whole batch back, trigger included.

### 001 — `stories` table + RLS ✅ applied 2026-08-16

```sql
-- UP
create table public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text not null check (mode in ('classic', 'interactive')),
  title       text not null,
  selections  jsonb not null,          -- genre/character/length/readingLevel/tone/lesson
  content     jsonb not null,          -- classic: {story}; interactive: {arc, beats, choices, beatChoices, ended}
  image_url   text,
  progress    real not null default 0,
  time_spent  integer not null default 0,
  opened      boolean not null default false,  -- drives regenerate-replaces-if-unread
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index stories_user_updated_idx on public.stories (user_id, updated_at desc);

alter table public.stories enable row level security;

create policy "own stories: select" on public.stories
  for select using (auth.uid() = user_id);
create policy "own stories: insert" on public.stories
  for insert with check (auth.uid() = user_id);
create policy "own stories: update" on public.stories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stories: delete" on public.stories
  for delete using (auth.uid() = user_id);

-- DOWN
drop table if exists public.stories;
```

### 002 — `updated_at` trigger

`default now()` fires on INSERT only; Postgres never touches `updated_at` on UPDATE. The eviction
rule ("the story being read is structurally never the oldest") depends on this column actually
moving, so it is enforced in the database rather than left to every caller in `lib/stories.ts`.

```sql
-- UP
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''          -- Supabase security linter: mutable search_path is an escalation vector
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- DOWN
drop trigger if exists stories_set_updated_at on public.stories;
drop function if exists public.set_updated_at();
```

## Tasks

- [x] 🟩 **Step 1: Provision Supabase + client plumbing**

  - [x] 🟩 Sarthak: create the Supabase project — `xbmhlczhufgbumukcdvu`, Free tier, magic-link redirect URLs configured
  - [x] 🟩 Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` + Vercel (all 3 environments)
  - [x] 🟩 Install `@supabase/supabase-js` + `@supabase/ssr`
  - [x] 🟩 [lib/supabase/client.ts](../lib/supabase/client.ts) (browser) and [lib/supabase/server.ts](../lib/supabase/server.ts) (server components / route handlers)
  - [x] 🟩 Vercel cron ping so the free project never pauses after 7 days idle — [app/api/cron/supabase-ping/route.ts](../app/api/cron/supabase-ping/route.ts) + [vercel.json](../vercel.json), guarded by `CRON_SECRET`
    - **Daily (`0 7 * * *`), not weekly as originally planned** — a weekly job leaves zero margin against a 7-day pause timer if one run is skipped, and the invocation cost is nil. Daily is also the max frequency Vercel's Hobby tier allows, so this works on either plan.
    - **Do not use `{ head: true }` on the probe.** A HEAD against a missing table 404s with an empty body, and postgrest-js ([issues/295](https://github.com/supabase/postgrest-js/issues/295)) converts exactly that case into a 204 with `error === null` — the health check reports `ok:true` even when `stories` doesn't exist. Verified live. Uses a real GET with `.limit(0)` instead.

- [ ] 🟨 **Step 2: Schema + RLS**

  - [x] 🟩 Apply migration 001 (`stories` table + RLS) via the Supabase SQL editor
  - [x] 🟩 Apply migration 002 (`set_updated_at` trigger) — added after 001 was already live, because `default now()` does not fire on UPDATE and eviction-by-`updated_at` would otherwise have silently evicted the story being read
    - Verified by backdating `updated_at`, then updating with a deliberately stale `updated_at`; the stored value came back as the current time, proving the trigger fires *and* overrides the caller. Note for future tests: `now()` is the *transaction* timestamp, so an insert-then-update inside one `begin…rollback` shows no delta even when the trigger works correctly.
  - [x] 🟩 Verify RLS as an anonymous caller: `SELECT` → `[]`, `INSERT` → `42501 row-level security violation` (401)
  - [ ] 🟥 Verify RLS with two real signed-in users once auth exists (Step 3) — confirm user B sees zero of user A's rows

- [ ] 🟥 **Step 3: Auth flow (magic link)**

  - [x] 🟩 Bump Next.js `16.2.10` → `16.3.1` first — closes 9 advisories including a **middleware/proxy bypass in App Router + Turbopack**; auth that can be bypassed is not auth
  - [x] 🟩 [app/auth/callback/route.ts](../app/auth/callback/route.ts) — verify via `token_hash` (works cross-device; the PKCE code flow breaks when the email opens in a different browser)
  - [x] 🟩 [lib/authRedirect.ts](../lib/authRedirect.ts) — `safeNextPath` (open-redirect guard) + `parseOtpType` (allowlist). Extracted from the route because Next rejects non-route exports from `route.ts`, **and** because they are only reachable on the route's success path — an HTTP test with a fake token silently exercises the failure path and proves nothing. 18 direct cases pass.
  - [x] 🟩 [proxy.ts](../proxy.ts) for session refresh — **not `middleware.ts`**: Next 16.3 deprecated that file convention, so it's `proxy.ts` exporting `proxy()`
  - [x] 🟩 [lib/useSession.ts](../lib/useSession.ts) — session hook, same `useSyncExternalStore` shape as the existing stores, plus `sendMagicLink()` / `signOut()`
  - [x] 🟩 Sign-out clears the local continue slot (shared-device hygiene) — in a `finally`, so a failed network sign-out still clears local state
  - [x] 🟩 **Supabase email templates switched to the `token_hash` form** — the stock templates use `{{ .ConfirmationURL }}` (the PKCE code flow), which would never deliver `token_hash` to the callback. Editing templates **requires custom SMTP**; Supabase's built-in sender is ~2/hr and read-only. Brevo added (see [docs/external-services.md](../docs/external-services.md)).
  - [x] 🟩 End-to-end magic link verified on desktop: `/auth/callback` → `307` → `/`, session established.
    Verified **cross-browser** (requested in Safari, opened in Chrome) — the harder case, and the one
    `token_hash` was chosen for. A same-browser-only check would have missed that this works at all.
  - [ ] 🟥 End-to-end magic-link test on a real phone (needs a deploy — a `localhost` link is unreachable from a phone by definition)
    - The issued token is `pkce_`-prefixed, because `@supabase/ssr` hardcodes `flowType: "pkce"` and stores the verifier in a per-browser **cookie**. This looked like it would reintroduce the cross-device failure, but does not: `verifyOtp` (auth-js:2458) posts `token_hash` to `/verify` and never reads the verifier — only `exchangeCodeForSession` needs it, and the callback never calls that. The prefix is inert here. **Confirmed empirically 2026-09-04** by the cross-browser test above: the link was requested in
      Safari (verifier cookie there) and verified in Chrome (no verifier cookie), and the session was
      still established. Still worth a hardware run, but the mechanism is no longer an assumption.
  - [ ] 🟥 Two-user RLS check (moved from Step 2 — needs real accounts): confirm user B sees zero of user A's rows

- [ ] 🟥 **Step 4: Persistence layer**

  - [ ] 🟥 `lib/stories.ts` — map the `ClassicContinueStory | InteractiveContinueStory` union to/from a row
  - [ ] 🟥 `lib/useLibrary.ts` (list) and `lib/useStory.ts` (single, by id)
  - [ ] 🟥 Auto-save on create; mark `opened` when the reader mounts
  - [ ] 🟥 Regenerate replaces the previous row in place when `opened = false`
  - [ ] 🟥 Evict oldest by `updated_at` past 20, deleting its cover blob

- [ ] 🟥 **Step 5: Rework cover-blob lifecycle (#46 landmine)**

  - [ ] 🟥 Remove `discardCover()` on continue-slot overwrite in [app/page.tsx](../app/page.tsx) for signed-in users — it would delete a _saved_ story's cover
  - [ ] 🟥 Delete covers only when a story row is deleted (user delete, eviction, regenerate-replace, account delete)
  - [ ] 🟥 Guests keep today's single-slot behavior unchanged

- [ ] 🟥 **Step 6: Library screen + nav**

  - [ ] 🟥 `app/library/page.tsx` — cover grid, History/Favourites segmented tabs (Direction A / frame A1)
  - [ ] 🟥 Capacity meter ("17 of 20 saved") + warning from 17
  - [ ] 🟥 Per-story delete with confirmation
  - [ ] 🟥 Favourites tab = empty-state shell, labelled as shipping with #55
  - [ ] 🟥 Guest empty state explaining what sign-in gets you — not a locked door
  - [ ] 🟥 `components/AppNav.tsx`: Library takes the Favourites seat, all three layouts (bottom bar / rail / sidebar)

- [ ] 🟥 **Step 7: The ask + the honesty line**

  - [ ] 🟥 End-of-story sign-in sheet (frame A2) — email field, "Send me a link", dismissible "Not now"
  - [ ] 🟥 "Check your email" state with resend cooldown
  - [ ] 🟥 "Saved on this phone only" line **inside the Library screen** (B's honesty, no banner on Home)

- [ ] 🟥 **Step 8: Home — real stories (closes #67)**

  - [ ] 🟥 Replace the fake `SAMPLE_STORIES` shelves in [components/HomeScreen.tsx](../components/HomeScreen.tsx) with real recent stories (frame A3)
  - [ ] 🟥 Empty/guest state for someone with no stories yet

- [ ] 🟥 **Step 9: Privacy (in scope, not deferred)**

  - [ ] 🟥 `/privacy` page — what we store, why, how to delete it
  - [ ] 🟥 Account delete that purges stories + Blob covers, verified end-to-end
  - [ ] 🟥 Nickname-over-real-name nudge in the custom character form
  - [ ] 🟥 Settings entry point for sign-out + delete account

- [ ] 🟥 **Step 10: Rate limiter keys on user**

  - [ ] 🟥 [lib/rateLimit.ts](../lib/rateLimit.ts): user id when signed in, IP for guests (fixes families sharing one router)

- [ ] 🟥 **Step 11: Guest → sign-in migration**

  - [ ] 🟥 On first sign-in, offer to import the single local continue slot
  - [ ] 🟥 DB becomes truth afterward; local slot keeps holding only the active story

- [ ] 🟥 **Step 12: Verify, review, document**
  - [ ] 🟥 `/verify` — guest path, sign-in, save, resume, delete, evict at 20, sign-out, account delete
  - [ ] 🟥 Playwright at iPhone 12 Pro light + dark, plus iPad/landscape
  - [ ] 🟥 `/code-review` + `/security-review` (RLS and session handling get real scrutiny)
  - [ ] 🟥 `/document` — CHANGELOG, and replace the stale schema sketch at [docs/architecture.md](../docs/architecture.md) lines 11–15
  - [ ] 🟥 UAT walkthrough, then close #92 and #67

## Risks

- **Magic link opened in a different browser** — the classic failure mode. Mitigated by the `token_hash` flow in Step 3; must be tested on a real phone where the email opens in the default browser, not the one that sent it.
- **Step 5 is the one that can destroy user data.** Deleting a cover that a saved story still references is silent and unrecoverable. Needs deliberate testing, not a glance.
- **Step 8 touches Home**, the most recently polished screen (#65/#62/#82) — regression risk on work that's already been UAT'd.
- **No automated test suite exists.** Everything here is caught by hand or by Playwright scripts written for the occasion.

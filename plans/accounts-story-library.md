# Accounts + Story Library — Implementation Plan

**Overall Progress:** `72%` — Steps 1–3 complete and verified on real hardware, two-user RLS check included. Step 4 (persistence) is next and unblocked.

**Issue:** [#92](https://github.com/aio-studios/children-story-app/issues/92) (sub-issue A of epic [#23](https://github.com/aio-studios/children-story-app/issues/23))
**Design:** [docs/designs/library-accounts-directions.html](../docs/designs/library-accounts-directions.html) — Direction A, frames A1–A3
**Last updated:** 2026-09-06

## ▶ Resume point (2026-09-06, session 3)

**Branch:** `feat/92-accounts-auth-foundation` — pushed, live on a Vercel preview. `main` untouched.
Now merged up to date with `main` (the #97 landing page), so `app/page.tsx` is the landing page and
the app lives at `app/create/page.tsx` — **Step 5's `discardCover()` work points at `app/create/page.tsx`
now, not `app/page.tsx`.**

**Preview:** `https://children-story-app-git-feat-92-accounts-auth-2cafb2-aio-studios.vercel.app`
Harness: append `/auth/test?t=<AUTH_HARNESS_TOKEN>` (Preview-scoped env var, rotated 2026-09-04).

**Steps 1–3 are DONE.** Magic-link sign-in passed cross-browser and cross-device on real hardware,
and the two-user RLS check passed all 8 assertions on 2026-09-06. Nothing in the auth or data-isolation
foundation is outstanding.

**Supabase was awake on 2026-09-06** — no idle pause to recover from. Health probe that distinguishes
a real outage from the resume trap below: DNS resolves, `/auth/v1/settings` → `200`, and
`/rest/v1/stories` → `200 []` with the anon key. A `PGRST205` on that last one is the trap, not a
dropped table.

**Next action: Step 4 (persistence layer).** Nothing blocks it.

**⚠️ Pre-merge checklist item (still open):** before this branch merges to `main`, change Supabase
**Site URL** from `http://localhost:3000` to the production URL. Site URL is the *silent fallback*
when a redirect target is not allowlisted — Supabase does not error, it just redirects there. With it
pointing at localhost, any production sign-in that misses the allowlist sends the user to their own
machine with no diagnostic anywhere. Harmless today only because production has no sign-in UI yet.

**Config changed in session 2 (all dashboard-side, not in the repo):**
- Vercel **Deployment Protection → Vercel Authentication turned OFF**. It was intercepting
  `/auth/callback` with an SSO redirect, which breaks magic links from mail apps (in-app webviews
  don't share the browser's Vercel cookie). Safe because `/auth/test` has its own server-side
  `AUTH_HARNESS_TOKEN` gate — that gate is what actually protects the Brevo quota.
- Supabase **Redirect URLs** gained `https://children-story-app-git-*-aio-studios.vercel.app/**`.

**Known trap, for whenever the project pauses again:** during a Supabase resume the API gateway
answers before Postgres does — healthy `/auth/v1/settings` and a clean REST `401` while table
queries 404 with `PGRST205`. Indistinguishable from a dropped table. Wait and re-poll. Cost a wrong
diagnosis in session 2. Written up in `supabase/migrations/README.md`.

**Watch-item, still live:** mail providers pre-fetch links to scan them, and a magic link is
single-use, so a scanner can consume the token before the user taps. Did **not** occur during the
2026-09-04 phone test, but the risk is real on any public URL. Mitigation if it starts happening:
an interstitial "click to finish signing in" page — scanners don't press buttons.

**Carry forward:** Step 5 is still the dangerous one (`discardCover()` deleting a saved story's
cover). Nothing has touched it yet.

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

- [x] 🟩 **Step 2: Schema + RLS**

  - [x] 🟩 Apply migration 001 (`stories` table + RLS) via the Supabase SQL editor
  - [x] 🟩 Apply migration 002 (`set_updated_at` trigger) — added after 001 was already live, because `default now()` does not fire on UPDATE and eviction-by-`updated_at` would otherwise have silently evicted the story being read
    - Verified by backdating `updated_at`, then updating with a deliberately stale `updated_at`; the stored value came back as the current time, proving the trigger fires *and* overrides the caller. Note for future tests: `now()` is the *transaction* timestamp, so an insert-then-update inside one `begin…rollback` shows no delta even when the trigger works correctly.
  - [x] 🟩 Verify RLS as an anonymous caller: `SELECT` → `[]`, `INSERT` → `42501 row-level security violation` (401)
  - [x] 🟩 Verify RLS with two real signed-in users once auth exists (Step 3) — done 2026-09-06, see Step 3

- [x] 🟩 **Step 3: Auth flow (magic link)**

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
  - [x] 🟩 End-to-end magic-link test on a real phone — **passed 2026-09-04** on the Vercel preview.
    Link requested on the phone, delivered to a mail app, opened in the browser iOS chose, session
    established (harness showed email + user id). This is the genuine cross-device case.
    - Confirmed on hardware 2026-09-04 — see the phone test above.
    - The issued token is `pkce_`-prefixed, because `@supabase/ssr` hardcodes `flowType: "pkce"` and stores the verifier in a per-browser **cookie**. This looked like it would reintroduce the cross-device failure, but does not: `verifyOtp` (auth-js:2458) posts `token_hash` to `/verify` and never reads the verifier — only `exchangeCodeForSession` needs it, and the callback never calls that. The prefix is inert here. **Confirmed empirically 2026-09-04** by the cross-browser test above: the link was requested in
      Safari (verifier cookie there) and verified in Chrome (no verifier cookie), and the session was
      still established. Still worth a hardware run, but the mechanism is no longer an assumption.
  - [x] 🟩 Two-user RLS check (moved from Step 2 — needs real accounts) — **all 8 assertions PASS, 2026-09-06**. Committed as [supabase/checks/rls_two_user_check.sql](../supabase/checks/rls_two_user_check.sql), not run ad hoc, because it must be re-run after any policy change. Covers both directions of read isolation, B's blocked update/delete of A's row (silent 0-row no-ops — the `using` clause filters the row out before the write, so nothing raises), and B forging a row owned by A (this one *does* raise `42501`: a `with check` violation has no row to filter out).
    - Run it **without RLS** in the SQL editor: it must start as the table owner to seed a row per user, then switches to `authenticated` itself.
    - **Design note worth keeping:** every measurement is taken into a variable while role-switched and written to the results table only after `reset role`. The first draft inserted results while still `authenticated` and died on `42501 permission denied for table rls_check` — correct behaviour from Postgres, and the fix is better than a grant would have been: the role under test now has no write access to the scoreboard at all.

- [ ] 🟨 **Step 4: Persistence layer** ← current

  - [x] 🟩 [lib/stories.ts](../lib/stories.ts) — maps the `ClassicContinueStory | InteractiveContinueStory` union to/from a row. Pure mapping, no Supabase calls. `selections`/`content` split so the setup half is mode-independent; `fromRow` returns null instead of throwing so one bad row can't take down the Library; validated via `storyHistory`'s exported `isValidContinueStory` so a row and a slot can't diverge. 29-case round-trip script passed 2026-09-06.
  - [x] 🟩 [lib/storyRepo.ts](../lib/storyRepo.ts) — **added to the plan**: all Supabase calls for stories. Mutations are called from event handlers, not render, so they don't belong in a hook module. Reads intentionally carry no `user_id` filter (RLS does it; a client-side `.eq()` would be decoration). Column list + sort verified against the live table.
  - [x] 🟩 [lib/useLibrary.ts](../lib/useLibrary.ts) — module store (both the Library grid and Home's Continue card read it, so a write must move both). Generation counter discards out-of-order fetches across a sign-out/sign-in; resets when the last listener detaches.
  - [x] 🟩 [lib/useStory.ts](../lib/useStory.ts) — per-screen state keyed by id, not a module store, so two open readers can't overwrite each other. Loading is *derived during render*, not reset in an effect: a changed id reads as loading in the same commit instead of flashing the previous story. (`react-hooks/set-state-in-effect` flagged the first draft, and it was pointing at exactly that bug.)
  - [x] 🟩 Auto-save on create; `opened` set when the reader mounts (not at creation, and not on a Continue-card impression). Wired in [app/create/page.tsx](../app/create/page.tsx) at four call sites: classic generate, classic cover-ready, interactive first beat, interactive updates. `persistInteractive` takes an explicit `isNew` flag — treating a beat as new would write a fresh row per beat.
  - [x] 🟩 Regenerate replaces the previous row in place when `opened = false` — `saveNewStory` in [lib/storyRepo.ts](../lib/storyRepo.ts). Three taps of "Try again" before reading leaves one story, not three drafts; a story someone actually read is kept and the regenerate lands beside it.
  - [x] 🟩 **Guest path verified unchanged** (2026-09-06, Playwright at 390×844): full setup deck → generate → reader, local slot written, **zero Supabase requests**, zero console errors. Guests are still 100% of real users, so this was the regression that mattered.
  - [ ] 🟥 **Not yet verified end-to-end with a real session.** The save path is unit-verified (29-case mapper round-trip; column list + sort checked against the live table) but no signed-in browser has actually written a row. Closing this needs either a test user with a known password, or Step 6/7's real UI. **Do not call Step 4 done until a row has actually landed.**
  - [ ] 🟥 Evict oldest by `updated_at` past 20, deleting its cover blob — **deliberately deferred into Step 5**, which already owns cover deletion. Writing it here would mean writing blob-deletion logic twice.
  - [x] 🟩 **Interim #46 guard:** `discardCover` no-ops for signed-in users. Leaks an orphaned Blob worth a fraction of a cent; the other way round costs a saved story its cover permanently. Step 5 replaces this with the real lifecycle.

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

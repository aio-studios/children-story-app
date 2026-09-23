# Accounts + Story Library — Implementation Plan

**Overall Progress:** `95%` — Steps 1–7 complete and verified. A guest who finishes a story is asked, once, whether they want to keep it; the Library carries the standing "Saved on this phone only" line; the `/auth/test` harness is retired. Four gates green (37/37 sheet, 42/42 screen, 16/16 persistence, 21/21 covers). Step 8 (Home — real stories) is next.

**Issue:** [#92](https://github.com/aio-studios/children-story-app/issues/92) (sub-issue A of epic [#23](https://github.com/aio-studios/children-story-app/issues/23))
**Design:** [docs/designs/library-accounts-directions.html](../docs/designs/library-accounts-directions.html) — Direction A, frames A1–A3
**Last updated:** 2026-09-23 (session 7)

## ▶ Resume point (2026-09-17, session 6)

**Branch:** `feat/92-accounts-auth-foundation` — 7 commits ahead of origin, **Step 7's work is
uncommitted in the working tree.** `main` untouched.

**Next action: Step 8 (Home — real stories, closes #67).** Replace the fake `SAMPLE_STORIES` shelves
in [components/HomeScreen.tsx](../components/HomeScreen.tsx) with real recent stories (frame A3), plus
an empty/guest state. ⚠️ Home is the most recently polished screen (#65/#62/#82) — regression risk on
work that has already been UAT'd.

**Steps 1–7 are DONE and verified.** Step 7 shipped the end-of-story sign-in sheet, the week-long
snooze, the Library's honesty line, and the deletion of `/auth/test`. It also fixed three real
persistence bugs that `/code-review` found in Steps 5/6 — see the Step 7 task list for what they were.

**FOUR regression gates now, re-run after ANY persistence change:**
- `scripts/verify-signin-sheet.mjs` — **37/37** (guest-only, so it needs no Supabase and costs nothing — run this one first, it catches the most for the least)
- `scripts/verify-library-screen.mjs` — **42/42** (seeds rows via PostgREST, free and fast)
- `scripts/verify-library-signed-in.mjs` — **16/16**
- `scripts/verify-cover-lifecycle.mjs` — **21/21** (~$0.16 in real cover images per run)

The last three need `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env.local` and a running
`npm run dev`, and all three **delete every story belonging to that account** — keep it a throwaway
user. Run them **spaced out**: back-to-back runs trip the 3/60s story-generation rate limit, which
presents as a Playwright timeout waiting for "Regenerate", not as a code failure.

**✅ CLEARED 2026-09-23: all four gates re-run green** against a freshly resumed Supabase project —
37/37 sheet, 42/42 screen, 16/16 signed-in persistence, 21/21 covers. The 16/16 run is the one that
mattered: it is what actually verified `updateContinueStory`, the Home-resume row pickup, and
`updateStory`'s `resetProgress`, which had shipped unverified on 2026-09-17.

**⚠️ The Supabase keep-alive cron has never run in production.** `vercel.json` and
`app/api/cron/supabase-ping/route.ts` were added in `13f1f7b` **on this branch**, and this branch has
never been pushed — so `main` has neither. That is why the project keeps pausing after 7 idle days
(the exact scenario `supabase/migrations/README.md` warns about). It fixes itself when this branch
merges; until then, expect to resume the project by hand from the dashboard.

**⚠️ Migration 003 is a DEPLOY dependency.** On any environment whose database has not had it run,
cover cleanup fails closed for *everyone including guests*. Never ship this branch somewhere 003 has
not been applied.

**⚠️ Pre-merge checklist item (still open):** before this branch merges to `main`, change Supabase
**Site URL** from `http://localhost:3000` to the production URL. Site URL is the *silent fallback*
when a redirect target is not allowlisted — Supabase does not error, it just redirects there. With it
pointing at localhost, any production sign-in that misses the allowlist sends the user to their own
machine with no diagnostic anywhere. **Now urgent twice over:** Step 6 put a real sign-in form on a
public page, and Step 7 put a second one in front of every guest who finishes a story.

**⚠️ Brevo's 300/day free tier is now genuinely on the critical path.** Two surfaces send magic links
(the Library pitch and the end-of-story sheet), against one surface before. Worth a look at Supabase's
own per-address auth rate limits before this ships. One thing that got *better*: deleting `/auth/test`
removed a third sender spending the same quota.

**Dashboard cleanup owed:** `AUTH_HARNESS_TOKEN` can be deleted from the Vercel project — nothing
reads it any more.

**Watch-item for Step 11 (from `/security-review`, below the reporting bar but relevant):**
`lib/useLibrary.ts` keeps the previous snapshot's stories during a fetch and on error. There is no
path to it today (sign-in lands via a server redirect and a full remount; sign-out clears immediately),
but Step 11's guest → signed-in migration is exactly the in-page account transition that would expose
it. Worth re-checking then.

**Config changed in earlier sessions (all dashboard-side, not in the repo):**
- Vercel **Deployment Protection → Vercel Authentication turned OFF**. It was intercepting
  `/auth/callback` with an SSO redirect, which breaks magic links from mail apps (in-app webviews
  don't share the browser's Vercel cookie). This was previously justified by `/auth/test` having its
  own server-side gate; that harness is now deleted, and the reasoning still holds — nothing behind
  the wall was protecting anything the gate wasn't.
- Supabase **Redirect URLs** gained `https://children-story-app-git-*-aio-studios.vercel.app/**`.

**Known trap, for whenever the project pauses again:** during a Supabase resume the API gateway
answers before Postgres does — healthy `/auth/v1/settings` and a clean REST `401` while table
queries 404 with `PGRST205`. Indistinguishable from a dropped table. Wait and re-poll. Written up in
`supabase/migrations/README.md`.

**Watch-item, still live:** mail providers pre-fetch links to scan them, and a magic link is
single-use, so a scanner can consume the token before the user taps. Did **not** occur during the
2026-09-04 phone test, but the risk is real on any public URL. Mitigation if it starts happening:
an interstitial "click to finish signing in" page — scanners don't press buttons.

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

- [x] 🟩 **Step 4: Persistence layer** (eviction moved to Step 5)

  - [x] 🟩 [lib/stories.ts](../lib/stories.ts) — maps the `ClassicContinueStory | InteractiveContinueStory` union to/from a row. Pure mapping, no Supabase calls. `selections`/`content` split so the setup half is mode-independent; `fromRow` returns null instead of throwing so one bad row can't take down the Library; validated via `storyHistory`'s exported `isValidContinueStory` so a row and a slot can't diverge. 29-case round-trip script passed 2026-09-06.
  - [x] 🟩 [lib/storyRepo.ts](../lib/storyRepo.ts) — **added to the plan**: all Supabase calls for stories. Mutations are called from event handlers, not render, so they don't belong in a hook module. Reads intentionally carry no `user_id` filter (RLS does it; a client-side `.eq()` would be decoration). Column list + sort verified against the live table.
  - [x] 🟩 [lib/useLibrary.ts](../lib/useLibrary.ts) — module store (both the Library grid and Home's Continue card read it, so a write must move both). Generation counter discards out-of-order fetches across a sign-out/sign-in; resets when the last listener detaches.
  - [x] 🟩 [lib/useStory.ts](../lib/useStory.ts) — per-screen state keyed by id, not a module store, so two open readers can't overwrite each other. Loading is *derived during render*, not reset in an effect: a changed id reads as loading in the same commit instead of flashing the previous story. (`react-hooks/set-state-in-effect` flagged the first draft, and it was pointing at exactly that bug.)
  - [x] 🟩 Auto-save on create; `opened` set when the reader mounts (not at creation, and not on a Continue-card impression). Wired in [app/create/page.tsx](../app/create/page.tsx) at four call sites: classic generate, classic cover-ready, interactive first beat, interactive updates. `persistInteractive` takes an explicit `isNew` flag — treating a beat as new would write a fresh row per beat.
  - [x] 🟩 Regenerate replaces the previous row in place when `opened = false` — `saveNewStory` in [lib/storyRepo.ts](../lib/storyRepo.ts). Three taps of "Try again" before reading leaves one story, not three drafts; a story someone actually read is kept and the regenerate lands beside it.
  - [x] 🟩 **Guest path verified unchanged** (2026-09-06, Playwright at 390×844): full setup deck → generate → reader, local slot written, **zero Supabase requests**, zero console errors. Guests are still 100% of real users, so this was the regression that mattered.
  - [x] 🟩 **Verified end-to-end with a real session, 2026-09-06 — 16/16 assertions.** [scripts/verify-library-signed-in.mjs](../scripts/verify-library-signed-in.mjs) drives a real browser as a real signed-in user and reads the rows back *through RLS with that user's own token*, never as an admin. Proves: a row lands with the right title/mode/selections/prose and `opened = false`; a regenerate replaces that row **in place** (same id, still one row); progress and reading time reach the row; and leaving the story to make a new one produces a **second** row with the first one's prose and progress untouched — the exact data-loss path the code review caught.
    - Session is built with `@supabase/ssr`'s **own** chunker and base64url helpers, so the cookie is byte-identical to one the app would write. Password grant rather than a magic link, because a magic link needs someone to read an inbox; the magic-link flow itself is verified separately on real hardware.
    - **One "failure" was the test's fault, worth remembering:** scrolling to the top before leaving the reader wrote `progress = 0`. That is correct — progress is *last position, not furthest* (UAT decision), so resuming reopens where you left off. The assertion now captures progress immediately before leaving and asserts it is unchanged.
  - [ ] 🟥 Evict oldest by `updated_at` past 20, deleting its cover blob — **deliberately deferred into Step 5**, which already owns cover deletion. Writing it here would mean writing blob-deletion logic twice.
  - [x] 🟩 **Interim #46 guard:** `discardCover` no-ops for signed-in users. Leaks an orphaned Blob worth a fraction of a cent; the other way round costs a saved story its cover permanently. Step 5 replaces this with the real lifecycle.

- [x] 🟩 **Step 5: Rework cover-blob lifecycle (#46 landmine) + eviction** — DONE 2026-09-06, verified 21/21

  - **The invariant, decided this session:** a cover Blob is deleted only once **no story row references it** — not "once it isn't yours". Ownership is the wrong question, because RLS collapses "referenced by someone else" (must refuse) and "referenced by nobody" (safe to delete) into the same zero rows. "Unreferenced" is also the right answer for a guest, whose covers are referenced by no row at all, so one rule covers both users.
  - **Ordering rule, everywhere:** remove the reference *first* (clear the slot, overwrite or delete the row), delete the Blob *second*, and only if the first succeeded. The reverse leaves a visible story with a permanently broken cover; this way round leaves an orphan worth a fraction of a cent.
  - [x] 🟩 [supabase/migrations/003_cover_is_referenced.sql](../supabase/migrations/003_cover_is_referenced.sql) — `security definer` function answering one boolean, plus a partial index on `image_url` (it scans across all users' rows, not just the caller's twenty). Granted to `anon` as well as `authenticated`: guests orphan covers too. **Written, not yet applied — Sarthak runs it in the SQL editor.**
  - [x] 🟩 Server-side guard in [app/api/delete-illustration/route.ts](../app/api/delete-illustration/route.ts) — 409 on a referenced cover, and **fail closed** (503) if the check itself errors, unlike the rate limiter above it which fails open. A delete we can't verify is a delete we don't do.
  - [x] 🟩 [lib/coverBlob.ts](../lib/coverBlob.ts) — one place that requests a Blob delete, so the guest path and the repo layer can't drift apart.
  - [x] 🟩 Remove the interim "signed-in users never clean up" guard in [app/create/page.tsx](../app/create/page.tsx). `discardCover` now skips only a cover the **current row** points at (`SavedRow` gained `imageUrl`, kept fresh when a late cover lands); everything else is offered to the endpoint, which re-checks against the database.
  - [x] 🟩 Delete covers when their row goes: `saveNewStory` replace-in-place deletes the cover it orphans, `deleteStory(id, imageUrl)` takes the cover with the row.
  - [x] 🟩 `evictBeyondLimit()` in [lib/storyRepo.ts](../lib/storyRepo.ts), `LIBRARY_LIMIT = 20`, fired fire-and-forget after each successful save. **Silent** — the capacity meter is Step 6's job (decided 2026-09-06). Deliberately does *not* use `listStories()`: that drops rows it can't map, which would hide a corrupt row from eviction and leave the library permanently over the cap.
  - [x] 🟩 Guests unchanged — `savedRowRef` is always null for them, so every cover they orphan is still deleted exactly as before.
  - [x] 🟩 **[scripts/verify-cover-lifecycle.mjs](../scripts/verify-cover-lifecycle.mjs) — 21/21, zero console errors.** Uses **real** Blobs on purpose: `deleteIllustration()` no-ops on anything outside its own path prefix, so a test built on fake URLs passes whether the code works or not. Costs ~$0.16 in real covers and wipes `TEST_USER_EMAIL`'s library.
  - [x] 🟩 Re-run [scripts/verify-library-signed-in.mjs](../scripts/verify-library-signed-in.mjs) — **16/16** after the review fixes. REST calls went 10 → 11, exactly the new authoritative cover read before a replace-in-place.
  - [x] 🟩 **`/code-review` — 4 findings, all confirmed and fixed.** Two were serious and both were fixed by making the design *simpler*, not by adding guards:
    - **A regenerate could have deleted the cover of the story it was saving.** A cover is on screen a round trip before the update attaching it to its row commits, so in that window the client *and* the database both call it unreferenced — and the server check cannot help, because the reference genuinely has not landed. `discardCover` is now **guests only**; signed-in covers are deleted exclusively by the row lifecycle. The "skip only if the current row owns it" cleverness that caused this is gone, and `SavedRow.imageUrl` with it.
    - **Replace-in-place trusted a stale client value.** Now reads the row's real `image_url` immediately before overwriting.
    - A partly-failed eviction deleted rows but skipped the refresh, leaving deleted stories on screen; rows are now counted only once actually gone.
    - Cleanup shared the paid-generation rate limit, so routine use leaked permanently (the row is already deleted when the 429 lands). Own budget now.
  - [x] 🟩 **`/security-review` — no HIGH/MEDIUM findings.** Cleared the definer function (one boolean, `search_path = ''`, fully qualified, explicit grants), the unauthenticated endpoint (now bounded to deleting orphans; before this step it would have deleted any story's cover), the blob-prefix guard (`del()` posts to Vercel's API rather than fetching the URL, so no SSRF), and client-driven eviction (RLS scopes it to the caller's own rows).
  - **Carry-forward for Step 6:** `markCurrentStoryOpened`'s `opened` flag is unreachable today (every path to Home clears the tracked row first) but becomes reachable once the Library opens a story by id — at which point a concurrent content update could reset it to `false` and let a regenerate overwrite a story the user had read.

- [x] 🟩 **Step 6: Library screen + nav** — DONE 2026-09-06, verified 42/42

  - [x] 🟩 [app/library/page.tsx](../app/library/page.tsx) + [components/LibraryScreen.tsx](../components/LibraryScreen.tsx) — cover grid, History/Favourites segmented tabs (Direction A / frame A1). Its own route, not a fifth view in `/create`: no generation state to hold, deep-linkable, and the screen a signed-in user reaches most often after Home.
  - [x] 🟩 Capacity meter ("18 of 20 saved") + warning for the last three slots
  - [x] 🟩 Per-story delete behind an `alertdialog` that names the story — the one irreversible action in the app
  - [x] 🟩 Favourites tab = empty-state shell, labelled as shipping with #55
  - [x] 🟩 Guest empty state explaining what sign-in gets you — not a locked door
  - [x] 🟩 [components/AppNav.tsx](../components/AppNav.tsx): Library takes the Favourites seat, all three layouts (bottom bar / rail / sidebar)
  - [x] 🟩 **Added to the plan: opening a saved story by id.** A library you can't open stories from is a wall of pretty dead cards, and it makes [lib/useStory.ts](../lib/useStory.ts) (written in Step 4) reachable at last. `/create?story=<id>`, consumed once and stripped. **This closes the Step 5 carry-forward** — `markCurrentStoryOpened` is now reachable, and the row is tracked *before* the mark since the mark reads that ref.
  - [x] 🟩 **Added to the plan: [components/SignInForm.tsx](../components/SignInForm.tsx).** Pulled forward from Step 7 so a guest can actually sign in from inside the app rather than via the token-gated harness. Step 7 wraps the same component in its sheet instead of writing a second one.
  - [x] 🟩 **Cross-route nav plumbing.** `AppNav` keeps its callback interface; the Library implements them as route pushes, and `/create` consumes `?new=1` / `?story=<id>` once each behind a ref guard (which also absorbs React's double-invoked effects).
  - [x] 🟩 **[scripts/verify-library-screen.mjs](../scripts/verify-library-screen.mjs) — 42/42, zero console errors.** Drives the real screen as a guest and as a real signed-in user, and checks the **database** after every mutation. Rows are seeded through PostgREST rather than generated: this suite is about the screen, and 19 real generations would cost money and minutes without testing anything more. (The cover suite is the opposite case — there, fake data makes the test meaningless.)
  - [x] 🟩 **`/code-review` at high — 7 findings, all confirmed and fixed.** The three that mattered:
    - **Deleting a story left its Continue card on Home**, offering to resume a story that existed nowhere. The continue slot now carries the row id it mirrors (`attachRowId`), so `clearContinueStoryForRow` clears that card and only that card.
    - **A card dated itself from `updated_at`**, which migration 002's trigger bumps on every touch — so opening a two-month-old story relabelled it "Today". `SavedStory` gained `createdAt`; ordering and eviction still use `updated_at`, which is what they want.
    - **`deleteStory` trusted a caller-cached `image_url`** — the same stale-value trap replace-in-place already closed. It reads the row's cover itself now, and eviction stopped passing one.
    - Also: `currentCover` degrades instead of throwing (a failed lookup must not abort the save it precedes); the "Opening your story…" overlay gained a Cancel (`useStory` has no timeout); a failed load offers Try again instead of a red line over an empty grid; and the delete dialog is keyboard-safe (Escape, focus on "Keep it", focus restored on close).
  - [x] 🟩 **`/security-review` — no HIGH/MEDIUM findings.** Cleared the `?story=` deep link (PostgREST parameterises, RLS scopes, `22P02` reads as not-found), the newly public magic-link form, and the narrowed `deleteStory` signature.
  - [x] 🟩 Screenshots at iPhone 12 Pro and iPad, light **and** dark, plus guest / empty / grid / Favourites / delete-dialog states

- [x] 🟩 **Step 7: The ask + the honesty line** — DONE 2026-09-17, 36/36 green

  - [x] 🟩 End-of-story sign-in sheet (frame A2) — [components/SaveStorySheet.tsx](../components/SaveStorySheet.tsx), wrapping [components/SignInForm.tsx](../components/SignInForm.tsx). Modal bottom sheet over the story; Escape / "Not now" / scrim all exit the same way; body scroll locked with `overflow` (not `position: fixed`, which would reset the scrollY the reader saves its position from); focus goes to the sheet, not the email field.
  - [x] 🟩 **Fires on finishing, not on opening.** Classic: scroll ≥ 0.98 AND a 30s floor (`isStoryFinished`, [lib/signInPrompt.ts](../lib/signInPrompt.ts)). Interactive fires on the `ended` transition. `openStoryInReader` burns the guard via `slotArrivesFinished` for a story that arrives already complete.
  - [x] 🟩 **UAT 2026-09-23 fix — the ask must NOT reuse `isContinueComplete`.** It did at first, and the sheet was effectively unreachable: that rule fails safe by keeping a Continue card around, which here means never asking. A quick story reads aloud in 60-90s and the reader's clock pauses on tab-hide, so 2 minutes of *visible* reading was a bar real parents don't clear. The two questions look identical and want opposite tuning — don't merge them again.
  - [x] 🟩 **"Not now" snoozes for a week, not forever** ([lib/signInPrompt.ts](../lib/signInPrompt.ts)). Direction A's own stated weakness was "one ask, one chance"; asking at the end of every story is worse. Garbled and far-future stored values both read as expired.
  - [x] 🟩 "Check your email" state with resend cooldown — **built in Step 6** (45s), lives in `SignInForm`. Gained an `onSent` callback so the sheet can relabel its exit to "Close" and stop treating it as a refusal.
  - [x] 🟩 "Saved on this phone only" line **inside the Library screen** (B's honesty, no banner on Home) — under the title, above the tabs, so it stays put while the guest pitch scrolls.
  - [x] 🟩 Deleted the `/auth/test` harness. `AUTH_HARNESS_TOKEN` can now be removed from the Vercel project.
  - [x] 🟩 **`scripts/verify-signin-sheet.mjs` — 36/36.** A guest suite: no Supabase, no seeded rows, no generated stories, so it runs offline and free. Covers the ask, the snooze (live/expired/garbled/clock-skewed), who does *not* get asked, the Library line, the 404 on the retired harness, and iPhone 12 Pro + iPad in light and dark.
  - [x] 🟩 `/code-review` at high — 3 findings, all confirmed against the code and all fixed (see below). `/security-review` — no HIGH/MEDIUM.

  **Three real bugs the review caught, all pre-existing in Steps 5/6, all fixed here:**
  - **The local slot was dropping its library row id** on every interactive beat and on every classic cover landing, because `saveContinueStory` replaces the slot wholesale. `clearContinueStoryForRow` matches on that id, so deleting the story from the Library left a ghost Continue card on Home. New `updateContinueStory` merges in place; `saveContinueStory` still replaces, which is right when a *different* story takes the screen.
  - **A Home resume never picked its row back up**, so every `persistProgress` no-opped: the card's % and `updated_at` froze, which also skews eviction (eviction is by `updated_at`).
  - **A regenerate inherited the replaced story's read state** — shown as "Finished" in the Library, and it suppressed this very sign-in ask, which reads the same rule. `updateStory` now takes `{ resetProgress }`, set only on the replace-in-place branch. Related: `markCurrentStoryOpened` now flips `opened` locally *before* the round trip, closing a window where a regenerate could overwrite a story already opened.

- [ ] 🟥 **Step 8: Home — real stories (closes #67)** ← current

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

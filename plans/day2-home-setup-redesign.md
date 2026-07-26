# Day 2: Home Screen + Setup-Flow Redesign

**Overall Progress:** `95%` (Steps 1-5, testing, code/security review, and docs all done, including UAT Round 2's header/nav redesign, now fully ported and shipped as of 2026-07-26; only Step 6 remains, blocked on you sourcing the 5 genre images)

## TLDR
Introduce a home screen (doesn't exist today — the app currently opens straight into setup) and convert the current single-scroll setup form into a 3-step dot-stepper wizard. Implements the direction signed off in [`docs/designs/day2-decided-direction.html`](../docs/designs/day2-decided-direction.html): mascot greeting, "Continue story" hero, two hardcoded content shelves, a genre strip to start new stories, then dot-stepper steps for Genre → Character → Customize. Also adds a persistent nav menu across every screen, and replaces genre emoji with static illustrated images. Covers issues #29 (home screen) and #30 (setup flow).

## Critical Decisions
- **Persistence: localStorage only** — no Supabase/accounts yet. "Continue story" and reading progress are saved client-side per device. This is throwaway-replaceable scaffolding for when real accounts land later (flagged, not hidden).
- **"Daily picks" / "Most popular" shelves: hardcoded, shipped as-is** — same fixed sample titles for every user/device, matching the mockup visually. Not personalized, not real popularity data. Revisit if/when there's a real content or analytics backend.
- **Screen flow stays a state machine in `app/page.tsx`** (matches existing `idle/loading/error/success` pattern) rather than new Next.js routes — adds `"home"` and step-indexed `"setup"` states. Smallest diff, no router/URL scope creep.
- **Setup steps map 1:1 to existing sections**: Step 1 = Genre (existing `GenreSelector`), Step 2 = Character (existing `CharacterSelector`), Step 3 = Customize (existing `PillSelector` × 3 + `LessonSelector`). No new selection components — just wizard chrome around what's already built.
- **Genre strip tap → jumps straight into setup at Step 2** (character), with that genre pre-selected — skips the redundant re-pick.
- **Nav menu scope: Home + New Story only.** Account/Settings/Premium/Saved-stories-library are explicitly deferred (Account needs Supabase auth, Premium is blocked on #27's COPPA decision, Saved-stories needs a full history list vs. today's single continue-slot) — logged as a follow-up issue, not built as disabled placeholders now.
- **Genre cards: static illustrated images, not emoji.** `GenreCard.tsx` already had a `// Placeholder for the real GIF/video asset (provider/format TBD)` comment — this fulfills that, not new scope. 5 genres = 5 one-time images (a few cents via image API), checked into `public/genres/`, not the per-story runtime illustration feature (#38, still deferred/priced separately).

## Tasks

- [x] 🟩 **Step 1: localStorage story history helper**
  - [x] 🟩 Added `lib/storyHistory.ts` — `saveContinueStory`, `useContinueStory` (React hook via `useSyncExternalStore`, not a plain getter — needed for hydration-safe/SSR-correct reads), `clearContinueStory`. Persists the *full* selection set (genre, character, length, readingLevel, tone, lesson), not just genre — a plain getter + genre-only save caused a real bug caught in `/verify` (see below)
  - [x] 🟩 `StoryReader`'s "Back to setup" clears the continue-slot (finished); navigating Home via the nav menu does not (still resumable); regenerating overwrites it

- [x] 🟩 **Step 2: Home screen component**
  - [x] 🟩 `components/HomeScreen.tsx`: mascot greeting, "Continue story" hero, two hardcoded shelves (Daily picks, Most popular), genre strip
  - [x] 🟩 Shelf cards are non-interactive (plain divs, no false affordance) — no story-ID system yet
  - [x] 🟩 Genre chip tap → setup Step 2 (character), genre pre-selected

- [x] 🟩 **Step 3: Setup wizard chrome**
  - [x] 🟩 `components/SetupStepper.tsx`: dot-stepper header, wraps the three existing sections, Back/Next footer (Next disabled until ready)
  - [x] 🟩 `app/page.tsx` refactored to a `view` state machine (`home/setup/loading/success/error`) + `setupStep`; all existing selection state/handlers unchanged

- [x] 🟩 **Step 4: Wire the state machine** — done as part of Step 3's refactor above

- [x] 🟩 **Step 5: Nav menu (hamburger/kebab)**
  - [x] 🟩 `components/NavMenu.tsx`: toggle + slide-out panel (Home, New Story), portaled to `document.body` — `.sk-topbar`'s `position: sticky` creates a containing block for `position: fixed` descendants, so rendering the panel inline had it covering only the header's ~65px instead of the full screen. Caught by `/verify`'s bounding-box check, fixed via `createPortal`
  - [x] 🟩 `components/AppShell.tsx`: header + nav wrapping every screen (home/setup/loading/reading/error)
  - [x] 🟩 `aria-label`, closes on Escape and backdrop click

- [ ] 🟥 **Step 6: Genre cards as static images**
  - [ ] 🟥 **Blocked on you:** 5 square (1:1) illustrations, ≥200×200px, PNG or WebP, one per genre — `public/genres/adventure.{png,webp}`, `fantasy.`, `animals.`, `bedtime.`, `sci-fi.` (matching the `id` field in `lib/genres.ts`). They'll fill the existing accent-colored circle via `object-cover`, so no transparency needed — a full-bleed square image works. Drop them in and let me know; I'll wire up the rest of this step once they exist
  - [ ] 🟥 Add `image` field to `Genre` type (`lib/types.ts`), one static asset path per genre
  - [ ] 🟥 Update `GenreCard.tsx` to render the image (via `next/image`) inside the existing accent-colored circle, replacing the emoji — custom/typed-in genre keeps the ✨ emoji fallback (no preset image exists for it)
  - [ ] 🟥 Reuse the same images at smaller size in the home screen's genre strip (`HomeScreen.tsx`), replacing `g.icon` there too

- [ ] 🟨 **Step 7: Testing & review**
  - [x] 🟩 `/verify` — 21/21 checks passed (Playwright, iPhone 12 Pro viewport, light + dark). Caught and fixed two real bugs: (1) the "Customize" step label clipped off the right edge on the 390px viewport - the exact class of bug flagged as a past miss when only testing approximate widths; (2) the nav overlay containing-block bug described in Step 5
  - [x] 🟩 `/code-review` (medium, 8-angle) — 8 findings, all fixed: localStorage write/read failures no longer swallow a successful generation or crash Home render (lib/storyHistory.ts now guards every localStorage call + validates shape on read); navigating away mid-generation no longer hijacks the screen the user moved to, and no longer silently blocks a legitimate retry (activeGenerationRef in page.tsx); resuming a custom genre/lesson no longer loses its draft text; consolidated the duplicate `--gc`/`--accent` CSS accent mechanisms, StoryReader's local font declarations, and HomeScreen's duplicate genre-accent lookup into single shared implementations (`lib/genres.ts`'s new `getGenreAccent`, `lib/fonts.ts`). Re-ran `/verify` after fixes - still 21/21
  - [x] 🟩 `/security-review` — no HIGH/MEDIUM findings. Client-side UI/state only, no `dangerouslySetInnerHTML`, no new API surface; the unchanged `/api/generate-story` route still allowlist-validates every field server-side, so a tampered `localStorage` continue-story value can't bypass it
  - [x] 🟩 `/document` — `CHANGELOG.md` (2026-07-25 entry) and `docs/architecture.md` (new component-tree + continue-story data-flow diagrams) updated

## Follow-up (not in this plan)
- `/create-issue` for a future nav-menu expansion: Account (needs Supabase auth), Settings, Upgrade to Premium (blocked on #27), Saved-stories/My-library (needs a full localStorage history list, not just the single continue-slot this plan adds)
- `/create-issue` for a future story-page kebab (⋮) menu — save story, custom regenerate instructions. Not built now: neither feature exists yet (see UAT Round 2 below), and "Regenerate" already has its own visible button - a kebab with nothing real in it would just be an empty affordance.
- `/create-issue` (or just remember) to rename the app to **"Kahani"**, possibly with a searchability-friendly suffix like "— a story app" (user's reasoning: people search "story" on their phone, want it to surface). User explicitly deferred the full sweep (package.json, README, docs, memory files, page titles, persona files) to its own dedicated pass rather than bolting it onto this session. Not started.

## UAT Round 2 (2026-07-25 evening → 2026-07-26 morning) — header/nav redesign

**Status: fully shipped as of 2026-07-26 08:50** — all 7 UAT observations resolved and in real code, `/verify` + `/code-review` + `/security-review` + `/document` all done. See "Header/nav port (2026-07-26)" below for what changed since the "Still to do" section was written.

After the "Overall Progress: 95%" state above shipped, live UAT surfaced 7 observations. Six were resolved and **already implemented in code** (items 1-6 below); the 7th (header/nav visual redesign) went through a live Artifact preview and was approved in the preview but not yet ported into the real components at the time — see "Still to do" for the plan as it stood, and the port section below for how it actually shipped.

### Already implemented in code (verify/re-review before considering done)
1. **Color-scheme bug, fixed**: `.sk-shell` was using `--sk-canvas` (tan) as the main content background everywhere. Per the signed-off mockup (and the already-shipped `StoryReader`'s own `.story-reader-canvas`/`-page` split), tan is only the *backdrop* — actual content sits on `--sk-bg` (cream). Fixed by adding `.sk-content` (cream, `max-width: 428px`, centered) inside `.sk-shell` (tan backdrop) — see `components/AppShell.tsx` + `app/globals.css`.
2. **Max-width, fixed**: same `.sk-content` change above solves the "awkward gap on laptop" complaint - one sensible breakpoint (matches `StoryReader`'s existing 428px column) rather than per-iPad-model pixel-tuned breakpoints, which was explicitly descoped as disproportionate for a mobile-first app.
3. **Genre-flow jump, fixed**: tapping a genre chip on Home now lands on Setup **Step 1** (Genre, pre-highlighted) instead of skipping straight to Step 2 (Character) - the skip felt jarring with no confirmation of what was picked. `handleSelectGenreFromHome`/`handleSelectCustomGenreFromHome` in `app/page.tsx`.
4. **Missing custom-genre entry, fixed**: added a "✨ Your own" tile at the end of Home's genre strip (`components/HomeScreen.tsx`), routes to Setup Step 1 with custom-genre mode active (reuses existing `selectCustomGenre()`).
5. **Shelf heading, fixed**: "New · Select genre" → "Start a new story" (`components/HomeScreen.tsx`).
6. **Carousel, fixed**: item-count number removed from shelf headers; `Daily picks`/`Most popular` now render each item twice (`loopedItems`) so scrolling doesn't dead-end after 4 cards - a real infinite-loop was judged not worth building for hardcoded placeholder data.

### Still to do: header/nav redesign (NOT yet in real code)
Observation 1 ("header doesn't match, feels bolted-on, name spacing off, ☰ unprofessional, no emojis, nav should slide from right with a nicer background") plus five follow-on rounds of feedback were resolved via an iterative **live Artifact preview**, saved to [`docs/designs/day2-header-nav-redesign-preview.html`](../docs/designs/day2-header-nav-redesign-preview.html) (open directly in a browser - light/dark toggle + Home/Setup/Story mode toggle are all interactive). Decisions locked in during preview iteration:

- **Layout**: iOS-style 3-zone bar - leading hamburger (moved from right to left), centered title, reserved trailing slot (empty on most screens).
- **Height**: compact ~48px bar (iOS nav-bar convention), down from the shipped ~68px.
- **Menu button**: real inline SVG hamburger icon, not the literal `☰` Unicode character (renders inconsistently per OS/font - likely the biggest single contributor to "looks unprofessional"). No border. Icon color = `--sk-brand`, not `--sk-ink`.
- **Wordmark**: "Storykins" text also recolored to `--sk-brand` (was default ink/near-black, which is what read as "sticks out").
- **Nav sheet**: still slides from the right (unchanged direction, was already correct - the "can't tell" complaint was actually two Artifact-preview-only bugs, see below, not the real app). Redesigned with its own mini-header (brand mark + explicit ✕ close button, not just backdrop-tap/Escape), background = `--sk-bg` (was the near-white `--sk-card-bg`, read as generic), plain-icon nav links with a brand-accent left-border on hover, **no emojis**.
- **Page-aware center title** (new pattern, applies beyond just styling): the center title isn't always "Storykins" -
  - Home/other screens → "Storykins" (brand color)
  - **Story reader** → the actual story's title (normal ink color, not brand - it's content, not the logo)
  - **Setup wizard** → **"New Story"** (my recommendation, echoes the nav link's own wording; alternatives discussed: "Story Setup", "Story Configuration" - user leaning towards deciding between "New Story"/"Story Setup", not yet finalized) - normal ink color, same treatment as the story title
- **Auto-hide on the story page only**: header slides away (`transform: translateY(-100%)`) after ~2.5s idle, reappears instantly on scroll or tap - same pattern as Apple Books/Safari reader mode. Explicitly scoped to the story reader only; Home/Setup keep the header always visible (hiding chrome mid-interaction on a short setup flow would be disorienting, not immersive).
- **Explicitly deferred, not building yet**: a functional trailing kebab (⋮) menu for story-specific actions (save story, custom regenerate instructions) - user's proposal, but neither underlying feature exists today and "Regenerate" already has its own button. The preview shows the icon *only* to establish where it'd live later; logged as a follow-up issue above, not implemented.

**Three bugs found and fixed in the Artifact preview tool itself** (not app bugs - none of this affects `components/NavMenu.tsx`, whose actual open/close logic was already confirmed working in `/verify`). All three are now Playwright-verified, not just eyeballed, after two rounds of claiming "fixed" too early:
1. Light/dark toggle set `data-theme` on a child `<div>`, but the CSS matched `:root[data-theme]` (the real `<html>` element) - Artifacts wrap the file in their own `<html>`/`<body>`, so that selector could never match. Fixed by scoping both the JS and CSS to `#demo-root`.
2. **The actual "menu won't close" bug**: `.nav-panel` (and separately `.icon-btn`, affecting the trailing button) declared `display: flex` directly in the class rule, which beats the browser's low-specificity `[hidden]{display:none}` default - so the `hidden` attribute was doing nothing and the panel was always rendered regardless of state. Fixed with a global `[hidden] { display: none !important; }` rule rather than patching each instance.
3. Even after fix #1, the theme toggle still didn't visibly change the background: `body`'s `background: var(--canvas)` read the variable via `:root`'s cascade, but `#demo-root[data-theme]`'s override sets `--canvas` on a `#demo-root` div *inside* body - custom properties cascade to descendants only, never back up to ancestors, so body structurally couldn't see it. Fixed by moving the background/color declarations onto `#demo-root` itself.

**Two more observations from the 2026-07-25 21:17 UAT pass on the preview itself (session paused here at ~98% usage, not yet fixed in the preview or ported to code):**
- **Nav-panel side mismatch**: the hamburger moved to the left (per the iOS-style redesign) but the slide-out panel still opens from the right - these should probably match (panel slides from the same side as its trigger button), left unresolved. Worth a quick gut-check next session on which side reads better before implementing either way.
- **Header doesn't stay pinned while scrolling in Story mode** in the preview - user confirmed this is an acceptable limitation of the quick mock, not a real-app requirement to fix in the preview itself; the *real* implementation still needs `position: sticky` (or fixed, given the auto-hide transform) to actually stay pinned - don't let the preview's shortcut leak into the real build.

**Next steps when resuming:**
1. Decide the nav-panel side (match the left-moved hamburger, or keep it right) - open question above.
2. Confirm the header truly stays pinned (not scroll-past) in the real implementation - the preview cut this corner, the real app can't.
3. Get final wording sign-off: "New Story" vs "Story Setup" for the setup-wizard header title.
4. Port the approved design into real code: `components/AppShell.tsx` (3-zone layout, compact height, page-aware title prop), `components/NavMenu.tsx` (SVG icons, redesigned sheet, brand colors, no border, correct slide side), `app/globals.css` (new `.sk-topbar`/`.sk-nav-*` rules, properly sticky/fixed), plus new auto-hide-on-idle behavior scoped to `components/StoryReader.tsx` only.
5. `AppShell` will need a way to know "what title to show" per screen (a `title`/`titleMode` prop from `app/page.tsx`, since it already knows the current `view` and, on the story screen, `generatedStory.title`).
6. Re-run `/verify` (all screens, light+dark, iPhone 12 Pro viewport) + `/code-review` + `/security-review` + `/document` once implemented - same as the rest of this plan.

### Header/nav port (2026-07-26 08:50) — how it actually shipped

Resuming decisions (asked directly, not guessed): nav panel slides from the **left** (matches hamburger), setup title is **"New Story"**, header pinning treated as a real-app requirement but not pre-emptively hardened beyond the standard `position: sticky` already used elsewhere - verified in `/verify` instead (confirmed working, no extra fix needed).

Ported into `components/AppShell.tsx` (new `pageTitle`/`autoHide` props, 3-zone layout, idle-timer effect for auto-hide) and `components/NavMenu.tsx` (SVG icons, redesigned sheet, left slide, brand colors), plus the corresponding `app/globals.css` rules.

`/verify` (Playwright, iPhone 12 Pro, light+dark, 8 checks including the header-pinning watch item) passed clean on the first pass. `/code-review` (high effort, 8-angle) found real bugs this time, not preview-tool quirks:
- **The exact "custom properties don't cascade to ancestors" bug class from the preview tool - now a real app bug**: `NavMenu`'s panel is `createPortal`'d to `document.body`, a DOM sibling of `.sk-shell` rather than a descendant. Both the `--sk-*` color tokens and `next/font`'s `--font-fredoka`/`--font-nunito` variables were scoped to `.sk-shell`, so neither resolved in the portaled panel - it rendered with a transparent background, black text, and system fallback fonts, letting the home screen bleed through underneath. Confirmed by actually screenshotting the open panel (a plain open/close functional check wouldn't have caught this). Fixed by moving `--sk-*` to `:root` and reapplying the font `.variable` classes on the portal's own root div.
- No scroll-lock on the panel (iOS drag-scroll-through) and no focus management (focus stranded on `<body>` after close) - both fixed.
- A `??`/truthy inconsistency in the title-fallback logic - fixed to one consistent check.

`/security-review`: no findings (pure client-side UI, no new attack surface). `/document`: `CHANGELOG.md` (2026-07-26 entry), `docs/architecture.md` (new "Header/nav redesign" subsection + updated portal-scoping note), this plan doc - all updated.

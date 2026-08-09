# V2 UI Build Batch — Setup-B + Nav-2 + Home-2

**Overall Progress:** `92%` — ✅ **PR 1 (Nav shell) + PR 2 (Home-2) SHIPPED & MERGED TO MAIN** (`6dd7ad0`, deployed). PR 2 folded in reader progress (Step 4) + greeting #82; UAT-approved 2026-08-08. Closed #61/#82/#73/#75/#62. **PR 3 (Setup-B "Immersive deck", #79) BUILT + VERIFIED + REVIEWED + DOCUMENTED — awaiting Sarthak UAT, then commit.**
**Epic:** [#76](https://github.com/aio-studios/children-story-app/issues/76) · **Screens:** Setup [#79], Nav [#73]/[#75], Home [#61]
**Design record:** [docs/designs/v2-redesign-decisions.md](../docs/designs/v2-redesign-decisions.md) · mocks in [docs/designs/](../docs/designs/)

## TLDR
Build the three approved V2 redesigns as one coherent batch: the **Immersive deck** setup flow (world → hero → customize, coverflow/landscape-split responsive), the **Bottom bar + Create** responsive navigation (bottom bar / left rail / iPad sidebar), and the **Create-first** home (top create block + big Continue card with % read + graceful-degrade discovery rows). The underlying selection state, generation logic, and continue-slot in [app/page.tsx](../app/page.tsx) stay; this is a presentation-layer rewrite of three surfaces plus one small persistence addition (scroll % → Continue card).

## Critical Decisions
Confirm these before build — the first three change what gets built.

- **D1 — Reader ↔ global nav.** The reader (Story + Interactive) is an immersive, auto-hiding-header experience. **Recommendation: global nav (bottom bar/rail/sidebar) is hidden inside the reader `view`**, same as it's effectively full-screen today; the reader keeps its own slim auto-hide top title bar. Nav returns on Home/Setup. *(Alternative: keep nav docked during reading — rejected, steals the immersion the reader was just built for in #80.)*
- **D2 — Nav tabs shipped now.** **Recommendation: ship Home + Create only** (per design doc); Favourites/Music are stubs that don't exist yet (#73 depends on them). Nav is built to grow to 3–4 tabs without rework.
- **D3 — "% read" source.** Add a `progress: number` (0–1) to the continue slot; the reader writes its scroll fraction (throttled), Home's Continue card reads it for the bar + label. **Recommendation: yes** — it's the one new bit of persistence, small and localStorage-only (moves to account with Supabase later).
- **D4 — Build order / PRs.** **Recommendation: three sequential PRs** in this order — (1) Nav shell, (2) Home, (3) Setup — each independently shippable and verifiable. Nav first because it's the shell the other two render inside. *(Setup-B is the biggest and most self-contained, so it lands last when the shell is stable.)*
- **D5 — Responsive detection.** One shared `useLayoutMode()` hook (matchMedia): `portrait` (compact width, tall) → bottom bar + coverflow; `landscape` (short height) → left rail + setup split; `tablet` (≥ tablet width) → sidebar + wider grids. Orientation matters independent of width, so this is matchMedia, not Tailwind breakpoints alone.
- **D6 — Art.** Reuse the shipped illustrated genre/character art (`genre.image`, #59) full-bleed with a legibility scrim — not the mock's emoji+gradient placeholders. Emoji stays only as the `onError`/missing-art fallback.
- **D7 — Covers stay pre-generated & cached.** Discovery rows keep using placeholder/colored cards (no real stories DB yet); **no on-the-fly image generation is introduced anywhere**. Real covers only ever come from the create-time Blob already saved to the continue slot. Rows degrade gracefully until a stories DB lands.

## Tasks

- [ ] 🟨 **Step 0: Shared foundation**
  - [x] 🟩 Add `useLayoutMode()` hook (matchMedia → `"portrait" | "landscape" | "tablet"`, SSR-safe default) per D5
  - [x] 🟩 Add `progress?: number` to both continue-slot variants + `saveProgress(fraction)` setter + validation in [lib/storyHistory.ts](../lib/storyHistory.ts) (per D3); back-compat: absent = 0. *(Done in PR 2. Setter is last-position + no-notify; reader restores scroll on resume — UAT decision. Also `isContinueComplete` to hide finished stories.)*
  - [x] 🟩 Add the V2 nav CSS block to [app/globals.css](../app/globals.css) (reuse `--sk-*` + `lib/genres.ts` accents). *(display:block caption fix belongs to the deck/home cards — carried in PR 2/3.)*

- [x] 🟩 **Step 1: Nav-2 — responsive navigation (PR 1) — SHIPPED, UAT-approved, committed `07dd185`**
  - [x] 🟩 New `AppNav.tsx`: bottom bar (portrait) / 64px left icon rail (landscape) / collapsible left sidebar (tablet), center **Create** action, Home + Create tabs (D2)
  - [x] 🟩 iPad sidebar: collapse/reopen handle inside the sidebar header (icon-only collapse, no floating tab — the deferred mock fix), persist open/closed in localStorage (useSyncExternalStore, matching storyHistory)
  - [x] 🟩 Rework [AppShell.tsx](../components/AppShell.tsx) to host `AppNav`; keep the reader's slim auto-hide top title bar (with NavMenu); hide global nav only in the reader (`view === "success"`, D1)
  - [x] 🟩 Kept [NavMenu.tsx](../components/NavMenu.tsx) — it lives in the reader's top bar (D1 refinement); `AppNav` is the global nav for Home/Setup/loading/error
  - [x] 🟩 Wire `onNavigateHome` / `onNavigateNewStory` + `activeTab` from [app/page.tsx](../app/page.tsx) into the new nav
  - [x] 🟩 Verified Create reachable + correct in all three shapes (Playwright, iPhone 12 Pro portrait/landscape + iPad, light+dark); code-review (3 findings fixed: a11y label, label refactor, comment), security-review (clean), `/document` (CHANGELOG + architecture.md).
  - [x] 🟩 **UAT round 1 (2026-08-07):** fixed brown-bar-on-top (greeting margin-collapse → top padding on nav content); added greyed **Favorites/Music/Settings** "Soon" tabs + **Create dead-center** in the bottom bar (WebKit-verified all 3 shapes light+dark). Item "dynamic mascot greeting" filed as [#82](https://github.com/aio-studios/children-story-app/issues/82) → folds into PR2. **Pending: Sarthak re-UAT → commit.**

- [x] 🟩 **Step 2: Home-2 — Create-first (PR 2) — BUILT + VERIFIED, awaiting UAT**
  - [x] 🟩 Rewrite [HomeScreen.tsx](../components/HomeScreen.tsx): "What story today?" create block pinned at TOP on every form factor
  - [x] 🟩 Genre tiles (3-up portrait → 6-up landscape/iPad) + striped "Your own" tile, full-bleed `genre.image` art + scrim (D6), emoji fallback
  - [x] 🟩 Big full-width **Continue** card directly below create block: % read bar + label from `progress` (D3); taller on iPad; hidden when no slot; real cover if present, graceful gradient fallback on missing/failed cover
  - [x] 🟩 Discovery rows below, degrading gracefully (placeholder sample cards, no live covers — D7); non-interactive `<div>` cards (no story to open yet); `loading="lazy"` art
  - [x] 🟩 Genre/level/length badges on the placeholder cover cards (real metadata capture waits on a stories DB)
  - [x] 🟩 Folded in **#82 greeting**: sticky `has-created` flag (returning vs first-time) + time-of-day eyebrow
  - [x] 🟩 Content column widened for landscape (760px) / tablet (900px)
  - [x] 🟩 **UAT round 1 (2026-08-07):** (1) redesigned bland "Your own" tile; (2) emoji → SVG across real UI; (3) Continue % → **last position + restore-scroll-on-resume** (fixed `mode`-discriminant bug that zeroed restore); (4) hide Continue card once complete. Reader emoji sweep filed as [#84](https://github.com/aio-studios/children-story-app/issues/84).
  - [x] 🟩 **UAT round 2 (2026-08-08):** (1) **"Your own" tile** rebuilt as a fan of the real genre arts radiating from a create hub; (2) **illustrated time-of-day mascot** generated via the #59 pipeline (`mascot-book` day / `mascot-night` evening, `useDaypart` picks both mascot + greeting) with a low-cost CSS "wave" (8KB img each, reduced-motion safe) over the SVG fallback; (3) **completion is now time-gated** — classic hides only at scroll ≥ 98% **and** `timeSpent ≥` 2 min (quick) / 10 min (longer), fixing short stories vanishing instantly; reader accumulates active reading time into `timeSpent`. Mascot options shown via preview Artifact (owl A/B/C → picked book+nightcap). WebKit-verified light+dark + time-gate logic via Playwright.
  - [x] 🟩 **UAT round 3 (2026-08-08):** (1) replaced the fan "Your own" tile with a **generated storybook illustration** (`public/your-own.jpg`, open book + worlds floating out) rendered as a normal genre-style tile — picked from a 3-option preview Artifact (worlds/book/pencil → worlds); (2) **Continue card legibility** — stronger bottom scrim + per-element text-shadows so overlaid text reads over light covers. Verified in the real grid + a light-cover stress test. **Pending: Sarthak final thumbs-up → commit.**

- [x] 🟩 **Step 3: Setup-B — Immersive deck (PR 3) — BUILT + VERIFIED, awaiting UAT**
  - [x] 🟩 New [SetupDeck.tsx](../components/SetupDeck.tsx) state machine: stage 0 world deck → stage 1 hero deck → stage 2 customize; whole screen themes to focused genre accent. Reuses page's `setupStep` as stage; page keeps ALL selection state, deck holds only `focus`/`customOpen` (re-seeded per stage via the render-phase adjust-state pattern, not an effect).
  - [x] 🟩 Portrait + iPad **coverflow** (centre card + peek both neighbours, wraps; arrows + tappable dots + drag-swipe); ignores the click that trails a swipe (guard scoped to card taps only, not the Continue button). Portrait hides side-card captions (they'd clip); iPad keeps them.
  - [x] 🟩 Landscape **split two-pane** (full-height art left, eyebrow→title→blurb + dots + Continue right, notch-safe inset). Art pane is a `<div>` + transparent overlay "choose" button + sibling arrow buttons (no invalid nested-interactive — code-review fix).
  - [x] 🟩 Wired custom paths the mock only stubbed: "Your own world" → inline text box in the CTA slot with a **Start →** disabled until non-empty; custom character → [CustomCharacterForm](../components/CustomCharacterForm.tsx) reused, replacing the deck, Continue disabled until filled. Draft-survival preserved.
  - [x] 🟩 Customize step reuses [PillSelector](../components/PillSelector.tsx)/[LessonSelector](../components/LessonSelector.tsx)/[StoryModeToggle](../components/StoryModeToggle.tsx)/[IllustrationToggle](../components/IllustrationToggle.tsx) (passed from page as a fragment); single column (portrait) / 2-col grid (landscape/iPad); sticky ✦ Create bar.
  - [x] 🟩 Swapped `SetupStepper` → `SetupDeck` in [app/page.tsx](../app/page.tsx) (added `AppShell` `flush` mode for full-viewport setup), preserving all selection state + draft-survival; **retired** SetupStepper + orphaned GenreSelector/GenreCard/CustomGenreCard/CharacterSelector/CharacterCard.
  - [x] 🟩 **UAT round 1 (2026-08-08):** (1) re-optimized deck art to **1024px** (was 240px → soft when enlarged; also fixed `optimize-art.mjs` mis-routing root assets); (2) **unified both custom paths** into the same form-panel + Continue bar (world 1 field / hero 3 fields), which also (3) removed the cramped inline "Start →"; (4) removed the Continue card's bookmark "ribbon" when a story has no cover. WebKit-re-verified all shapes + both custom paths.
  - [x] 🟩 **UAT round 2 (2026-08-08):** (1) generated a **distinct hero-card illustration** (dress-up chest, `public/create-hero.jpg`, picked from 3 candidates) so world vs hero cards no longer share `/your-own.jpg`; (2) **storybook-toned form labels** (questions in the display font + placeholders) replacing "Name/Traits/Appearance"; (3) true **card-flip + expand** on the make-your-own cards (front = art, back = form; GPU rotateY+scale, back defines height so no reflow, reduced-motion lands on the form). Re-verified (flip settles on a usable, correctly-oriented form; typing works) + build clean.

- [x] 🟩 **Step 4: Reader progress plumbing (folded into PR 2)**
  - [x] 🟩 [StoryReader](../components/StoryReader.tsx) writes throttled `window` scroll fraction via `saveProgress` (**last position**, final on unmount) **and restores scroll on resume** via an `initialProgress` prop (UAT: pick up exactly where you left off). [InteractiveStoryReader](../components/InteractiveStoryReader.tsx) uses arc progress (`beats/arc.max`) computed in `persistInteractive` instead — a truer "% read" for a branching story (D3 deviation, better metric than scroll).

- [ ] 🟨 **Step 5: Verify + review + document**
  - [x] 🟩 `/verify` end-to-end via Playwright: portrait (390×844) / landscape (844×390) / iPad (820×1180) × light+dark, golden path (world→hero→customize→back) + both custom paths; asserted no horizontal overflow / collapsed cards / missing CTAs. All passed.
  - [x] 🟩 `/code-review` (2 findings fixed: invalid nested-interactive controls in the landscape split → sibling buttons + overlay; removed a dead `chooseFocused` branch) + `/security-review` (clean — presentational, no new backend data flow).
  - [x] 🟩 `/document`: CHANGELOG.md (2026-08-08 section) + [docs/architecture.md](../docs/architecture.md) (both setup diagrams → SetupDeck, deck stage/readiness prose, AppShell `flush`).
  - [ ] 🟥 UAT walkthrough for Sarthak; on sign-off, commit, then move #79 (+ batch #73/#75/#61) cards to Done + close.

## Out of scope (explicit)
- Real curated/popular/per-genre discovery feeds (needs a stories DB — overlaps #52/#54/#55, deferred).
- Favourites + Music pages/tabs (#73 grows into them once scoped).
- Book mode #77, reader/story-page re-exploration (deprioritized; reader just reworked in #80).
- ⚠️ Carryover, not this batch: covers won't render in prod until `GOOGLE_GENERATIVE_AI_API_KEY` is added to Vercel env (#38).

# V2 UI Build Batch — Setup-B + Nav-2 + Home-2

**Overall Progress:** `30%` — PR 1 (Nav shell) built, verifying.
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
  - [ ] 🟥 Add `progress?: number` to both continue-slot variants + `saveProgress(fraction)` setter + validation in [lib/storyHistory.ts](../lib/storyHistory.ts) (per D3); back-compat: absent = 0 *(deferred to PR 2 — Home consumes it)*
  - [x] 🟩 Add the V2 nav CSS block to [app/globals.css](../app/globals.css) (reuse `--sk-*` + `lib/genres.ts` accents). *(display:block caption fix belongs to the deck/home cards — carried in PR 2/3.)*

- [ ] 🟨 **Step 1: Nav-2 — responsive navigation (PR 1)**
  - [x] 🟩 New `AppNav.tsx`: bottom bar (portrait) / 64px left icon rail (landscape) / collapsible left sidebar (tablet), center **Create** action, Home + Create tabs (D2)
  - [x] 🟩 iPad sidebar: collapse/reopen handle inside the sidebar header (icon-only collapse, no floating tab — the deferred mock fix), persist open/closed in localStorage (useSyncExternalStore, matching storyHistory)
  - [x] 🟩 Rework [AppShell.tsx](../components/AppShell.tsx) to host `AppNav`; keep the reader's slim auto-hide top title bar (with NavMenu); hide global nav only in the reader (`view === "success"`, D1)
  - [x] 🟩 Kept [NavMenu.tsx](../components/NavMenu.tsx) — it lives in the reader's top bar (D1 refinement); `AppNav` is the global nav for Home/Setup/loading/error
  - [x] 🟩 Wire `onNavigateHome` / `onNavigateNewStory` + `activeTab` from [app/page.tsx](../app/page.tsx) into the new nav
  - [x] 🟩 Verified Create reachable + correct in all three shapes (Playwright, iPhone 12 Pro portrait/landscape + iPad, light+dark); code-review (3 findings fixed: a11y label, label refactor, comment), security-review (clean), `/document` (CHANGELOG + architecture.md).
  - [x] 🟩 **UAT round 1 (2026-08-07):** fixed brown-bar-on-top (greeting margin-collapse → top padding on nav content); added greyed **Favorites/Music/Settings** "Soon" tabs + **Create dead-center** in the bottom bar (WebKit-verified all 3 shapes light+dark). Item "dynamic mascot greeting" filed as [#82](https://github.com/aio-studios/children-story-app/issues/82) → folds into PR2. **Pending: Sarthak re-UAT → commit.**

- [ ] 🟥 **Step 2: Home-2 — Create-first (PR 2)**
  - [ ] 🟥 Rewrite [HomeScreen.tsx](../components/HomeScreen.tsx): "What story today?" create block pinned at TOP on every form factor
  - [ ] 🟥 Genre tiles (3-up portrait → 6-up landscape/iPad) + "Create your own" tile, reusing `genre.image` art (D6)
  - [ ] 🟥 Big full-width **Continue** card directly below create block: % read bar + label from `progress` (D3); extra-tall on iPad; hidden when no continue slot
  - [ ] 🟥 Discovery rows below, degrading gracefully (placeholder/recent, colored cards, no covers — D7); lazy-friendly markup
  - [ ] 🟥 Cover/genre/level/length badges on cards where real metadata exists (captured at create-time)

- [ ] 🟥 **Step 3: Setup-B — Immersive deck (PR 3)**
  - [ ] 🟥 New `SetupDeck.tsx` state machine: stage 0 world deck → stage 1 hero deck → stage 2 customize; whole screen themes to focused genre accent
  - [ ] 🟥 Portrait + iPad **coverflow** (centre card + peek both neighbours, wraps; arrows + tappable dots + drag-swipe); ignore the click that trails a swipe
  - [ ] 🟥 Landscape **split two-pane** (full-height art left, eyebrow→title→blurb + dots + Continue right, notch-safe inset)
  - [ ] 🟥 Wire real custom paths the mock only stubbed: "Your own world" card → [CustomGenreCard](../components/CustomGenreCard.tsx) input; custom character → [CustomCharacterForm](../components/CustomCharacterForm.tsx)
  - [ ] 🟥 Customize step reuses [PillSelector](../components/PillSelector.tsx)/[LessonSelector](../components/LessonSelector.tsx)/[StoryModeToggle](../components/StoryModeToggle.tsx)/[IllustrationToggle](../components/IllustrationToggle.tsx); single column (portrait) / 2-col (landscape/iPad); sticky Create bar
  - [ ] 🟥 Swap `SetupStepper` → `SetupDeck` in [app/page.tsx](../app/page.tsx), preserving all existing selection state + draft-survival behavior; retire [SetupStepper.tsx](../components/SetupStepper.tsx)

- [ ] 🟥 **Step 4: Reader progress plumbing**
  - [ ] 🟥 [StoryReader](../components/StoryReader.tsx) + [InteractiveStoryReader](../components/InteractiveStoryReader.tsx) write throttled scroll fraction via `saveProgress` (D3)

- [ ] 🟥 **Step 5: Verify + review + document**
  - [ ] 🟥 `/verify` end-to-end (all three form factors, light+dark, exact device viewports e.g. iPhone 12 Pro + iPad) via Playwright
  - [ ] 🟥 `/code-review` + `/security-review` on the diff; fix or knowingly accept findings
  - [ ] 🟥 `/document` (CHANGELOG.md) + update [docs/architecture.md](../docs/architecture.md) (new nav/deck/home components, `progress` field)
  - [ ] 🟥 UAT walkthrough for Sarthak; on sign-off, move #79/#73/#75/#61 cards to Done + close

## Out of scope (explicit)
- Real curated/popular/per-genre discovery feeds (needs a stories DB — overlaps #52/#54/#55, deferred).
- Favourites + Music pages/tabs (#73 grows into them once scoped).
- Book mode #77, reader/story-page re-exploration (deprioritized; reader just reworked in #80).
- ⚠️ Carryover, not this batch: covers won't render in prod until `GOOGLE_GENERATIVE_AI_API_KEY` is added to Vercel env (#38).

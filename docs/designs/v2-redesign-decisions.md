# V2 UI Redesign — Design Research & Decisions

**Status:** Exploration complete for Setup, Navigation, Home. Directions chosen **and all three responsive mocks approved** (Setup-B responsive signed off 2026-08-07); **build is the next step — one coherent batch via `/create-plan`.**
**Last updated:** 2026-08-07
**Epic:** [#76 — V2 UI: mobile-native polish, navigation & orientation](https://github.com/aio-studios/children-story-app/issues/76)

This is the durable record of the V2 redesign design-research exercise so the decisions aren't lost between sessions. Each screen was explored with **2–3 genuinely different interactive wireframe directions** (published Artifacts, real content, light/dark), debated, and one direction chosen. Nothing here is built yet — this is Planning-stage output that feeds `/create-plan`.

---

## Process & principles (apply to all remaining screens)

- **3-direction exploration per screen.** Not three skins of one idea — genuinely different structural approaches, so there's something real to debate.
- **Anchor visual language = Setup direction B.** The first chosen direction sets the language; every other screen's directions are *three ways to solve that screen's problem in the same language*, never three unrelated aesthetics. This keeps V2 one coherent app.
- **Responsive is a standing requirement.** Every screen is designed for **phone portrait AND phone landscape AND iPad** from the start (ties to #75), not phone-only.
- **Polish bar from the first draft.** Clean type scale (no fractional px), hairline borders on every card for definition, consistent 16px gutter + even vertical rhythm, intentional eyebrow→title hierarchy. (Sarthak flagged unpolished mocks once; don't repeat. Ties to #63.)
- **Mocks live in `docs/designs/*.html`**, published as private Artifacts. Reuse the shared Storykins token block; fonts fall back to Baloo 2/Nunito because the artifact CSP blocks the real Fredoka/Nunito webfonts — on-device type will be crisper.
- **Always `node --check` the inline `<script>` before publishing** (a missing brace once rendered a mock half-blank).

### Anchor language (from Setup B)
Storybook palette from `app/globals.css` (`--sk-*` tokens), per-genre accent colors (light/dark) from `lib/genres.ts`, **full-bleed genre/character art** with title on a legibility scrim, generous rounding, Fredoka (display) + Nunito (body). Per-genre accents: Adventure `#B85C27/#E8A06B`, Fantasy `#7B4C9E/#C79EE8`, Animals `#4C7A3F/#93CC7E`, Bedtime `#3E4E86/#9AAEEF`, Sci-fi `#1D7A8C/#7BDCEA`.

---

## Screen 1 — Setup flow (#79) → **Direction B "Immersive deck"**

**Issue:** [#79](https://github.com/aio-studios/children-story-app/issues/79) · **Mock:** `docs/designs/setup-flow-wireframes.html` · **Artifact:** https://claude.ai/code/artifact/d642046e-386e-4de3-83c4-80f3fef30fca

**Directions explored:**
- **A — Tap-through:** keeps the 3-step stepper but auto-advances on tap; full-bleed 2-col genre tiles; back = top-left chip; custom-genre card expands in place. Safe, spec-literal, least "wow".
- **B — Immersive deck ✅ CHOSEN:** one world at a time as full-bleed themed hero cards you swipe; the whole screen themes to the focused genre; tap a card (or Start) → hero deck → customize. Most cinematic/app-native.
- **C — Continuous canvas:** no step screens; a single scroll that reveals Character then Customize inline as you choose. Most modern, densest.

**Why B:** most app-native, best portfolio bar; establishes the anchor language. **Agreed adjustment before build:** add a **peek of the next card + subtle arrows** so horizontal swipe is discoverable (mitigates B's one real risk).

**Setup-B responsive adaptation — DONE & APPROVED (2026-08-07).** Mock: `docs/designs/setup-B-responsive.html` · Artifact: https://claude.ai/code/artifact/936d0fb2-5413-4526-9128-a58e265557f0. One deck model, three shapes: **phone portrait & iPad = a wrapping coverflow** (big centre card + peeks of both neighbours, arrows/dots/drag, wraps past both ends); **phone landscape = split two-pane** (full-height art left, title/blurb/dots/Continue right, notch-safe inset). Consistent everywhere: pagination **dots** (not a thumbnail rail), identical per-step copy, single **"Continue →"** CTA, and one selection model (tap centre card or Continue → advance; tap a side card → centre it). Screenshot-verified light + dark via Playwright.

Setup content (real, from `lib/genres.ts` + `lib/storyOptions.ts`): 5 genres × 3 characters each; Customize = Length (Quick ~2 min / Longer ~10 min), Reading level (Toddler / Early reader / Independent reader), Tone (Funny / Calming / Exciting / Heartwarming), Lesson (Kindness / Courage / Sharing / Honesty / Perseverance), plus Interactive-mode + Illustration toggles.

---

## Screen 2 — Navigation (#73, + landscape #75) → **Direction 2 "Bottom bar + Create"**

**Issue:** [#73](https://github.com/aio-studios/children-story-app/issues/73) · **Mocks:** `docs/designs/navigation-wireframes.html` (3-way compare), `docs/designs/navigation-B-responsive.html` (chosen, all form factors) · **Artifacts:** compare https://claude.ai/code/artifact/b6dbf18e-19a4-4cc2-a042-3307297f96d3 · responsive https://claude.ai/code/artifact/c58ff398-76a6-4735-bf03-60052f5f2f0a

**Directions explored:**
- **1 — Floating pill + side nav:** #73 literal — translucent auto-hiding pill bar + hamburger side panel that mirrors it. Keeps two navs showing the same items (redundant).
- **2 — Bottom bar + Create ✅ CHOSEN:** single nav, no hamburger; center **Create** button owns the primary action; secondary items in a "More" sheet. Resolves the bottom-vs-side redundancy #73 flagged.
- **3 — Top segmented:** no bottom bar; a themed tab strip under a slim header, overflow "⋯". Content-first but top targets are a thumb-stretch on tall phones.

**Why 2:** most app-native; kills redundancy; keeps Create (the app's whole purpose) permanently under the thumb.

**Responsive — one nav model, three shapes:**
- **Phone portrait →** bottom bar + center Create.
- **Phone landscape →** compact **64px left icon rail** (a bottom bar would waste ~20% of the short height — the #75 win).
- **iPad (both orientations) →** full **left sidebar** (icons + labels), and content goes multi-column instead of a stretched single column.
- Breakpoint logic for build: compact width & portrait → bottom bar; short height → rail; ≥ tablet width → sidebar. Create reachable in every shape.

**iPad sidebar = collapsible drawer** with a big edge arrow (slides out, content reflows to full width).

**Build refinements to remember (deferred):**
- The open-state drawer handle currently overlaps the story cards in the mock. Clean fix at build: put the **close** control inside the sidebar header, float a **reopen** handle only when collapsed (no protruding tab over content).
- **Persist** the sidebar collapsed/open state in localStorage.
- **Favourites & Music destinations don't exist yet** — nav can ship as **Home + Create** first and grow to 3–4 tabs as those pages are built/scoped.

---

## Screen 3 — Home (#61) → **Direction 2 "Create-first"** (+ giant Continue card)

**Issue:** [#61](https://github.com/aio-studios/children-story-app/issues/61) · **Mocks:** `docs/designs/home-wireframes.html` (3-way compare), `docs/designs/home-B-responsive.html` (chosen, all form factors) · **Artifacts:** compare https://claude.ai/code/artifact/fcecb011-b7cc-4209-b28c-b39723942c06 · responsive https://claude.ai/code/artifact/874e0f9e-2c84-4a7f-849a-38966e70b50a

**Directions explored (differ by *what Home is for*, and how much unbuilt backend each needs):**
- **1 — Netflix discovery:** #61 literal — featured hero + endless curated rows. Highest wow, but leans hardest on a content backend that **doesn't exist** (stories DB, popularity/curation feeds, cached covers); rows render empty without a catalog. A facade today.
- **2 — Create-first ✅ CHOSEN:** top of Home leads with "What story today?" + genre tiles + Create-your-own (works with **zero backend**); discovery rows sit below and **degrade gracefully** (start as the user's own recent stories → grow into curated feeds later). Ships a polished, *functional* Home now with a clean runway to the full #61.
- **3 — Continue + Library:** centers your own stories (works from localStorage today); curated rows additive. Warm, less firehose.

**Why 2:** looks great AND ships now without pretending to have content we don't.

**Refinements from Sarthak:**
- **"What story today?" create block stays at the TOP** on every form factor.
- **Continue is a big full-width card right below it** (not a small row item) showing **% read** — derived from the reader's **scroll position, persisted** between visits — with a progress bar that fills to match.
- Genre tiles: 3-up (portrait) → 6-up (landscape/iPad). Discovery rows below.
- Cover cards carry **genre / reading-level / length** badges per #61.

**Responsive:** phone portrait (bottom bar), phone landscape (icon rail, tiles 6-up), iPad (collapsible sidebar, extra-tall Continue card).

**Backend constraints (carry into build/planning):**
- **Covers must be pre-generated & cached** (Vercel Blob) at story-create time and served as static URLs — **never generated on-the-fly**. An AI image per card (~$0.04, #38) across an infinite feed is a runaway cost + slow-scroll risk; infinite scroll must lazy-load.
- Real curated/popular/per-genre rows need a **stored/queryable stories DB** that doesn't exist yet (overlaps Day-3 social #52/#54, favourites #55). Create-first degrades gracefully until it lands.
- Badge metadata (reading level, length bucket, genre) must be captured at story creation.

---

## Cross-cutting build notes

- **Ship order friendly:** nav can launch Home + Create only; Home Create-first works today; discovery rows and Favourites/Music grow in later. Setup-B is a UI change over existing selections (no new backend).
- **Persist UI states** (iPad sidebar open/closed, Continue % read) in localStorage now; move to account when Supabase auth lands.
- **Interactive story mode already shipped** (PR #80 merged to `main`, closed #37/#48/#49/#50). ✅ Prod covers work — the Gemini key is set in Vercel; cover generation live-tested against prod (200 + public Blob PNG), most recently 2026-08-08.

## Open items / next steps

1. ✅ **Setup-B landscape/iPad adaptation** (+ peek/arrows fix) — done & approved 2026-08-07 (see Screen 1 above).
2. **`/create-plan`** to consolidate Setup-B + Nav-2 + Home-2 into the actual V2 implementation batch — **this is the immediate next step.**
3. **Scope Favourites + Music pages** (#73 depends on them for the full 3-tab nav).
4. **Reader / Story page** — optional next exploration (deprioritized; reader was just reworked in #80). Book mode #77 / landscape #75 relate.
5. **Visual-craft pass #63** — the polish standards above should fold into the build.

> **Mock QA note (2026-08-07):** all `docs/designs/*.html` mocks were Playwright-audited; fixed collapsed hero cards (inline `<span>` `height` no-op) in home-B & home-wireframes and run-together captions in setup-flow-wireframes/home-B/home-wireframes. Carry the `display:block` fix into the built components.

## Quick reference — artifacts, mocks, issues

| Screen | Decision | Mock file(s) | Artifact URL(s) | Issue |
|---|---|---|---|---|
| Setup | B "Immersive deck" | `setup-flow-wireframes.html`, `setup-B-responsive.html` (responsive, approved) | .../d642046e-386e-4de3-83c4-80f3fef30fca, .../936d0fb2-5413-4526-9128-a58e265557f0 | #79 |
| Nav | 2 "Bottom bar + Create" | `navigation-wireframes.html`, `navigation-B-responsive.html` | .../b6dbf18e-19a4-4cc2-a042-3307297f96d3, .../c58ff398-76a6-4735-bf03-60052f5f2f0a | #73, #75 |
| Home | 2 "Create-first" + giant Continue | `home-wireframes.html`, `home-B-responsive.html` | .../fcecb011-b7cc-4209-b28c-b39723942c06, .../874e0f9e-2c84-4a7f-849a-38966e70b50a | #61 |

All mock files are in `docs/designs/`. Decisions are also recorded as comments on the respective GitHub issues.

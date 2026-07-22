# Story Customization Selectors — Implementation Plan

**Overall Progress:** `100%`

**GitHub issue:** [#8](https://github.com/aio-studios/children-story-app/issues/8) (sub-issues #9 length, #10 reading level, #11 tone, #12 lesson/value) — second feature of Epic 1 (Day 1 MVP)

## TLDR
Four single-value pill selectors (length, reading level, tone, lesson/value) added to the existing single-page setup screen, below Character selection. Same client-side-only state pattern as genre/character — no backend, no content filtering (that's #16). Continue button stays non-clickable (story generation, #13, isn't built yet) but its styling now reflects whether all 6 selections (genre, character, and these 4) are complete.

## Critical Decisions
- **Placement**: same page (`app/page.tsx`), new section below Character — Day 1 stays single-page (per issue #30).
- **UI**: one reusable `PillSelector` component (compact chip buttons), not the illustrated card style used for genre/character — these are plain single-value picks with no per-option imagery.
- **Options** (fixed, not genre-dependent):
  - Length: Quick (~2 min) / Longer (~10 min) — default **Quick**
  - Reading level: Toddler / Early reader / Independent reader — default **Early reader**
  - Tone: Funny / Calming-bedtime / Exciting / Heartwarming — default **Heartwarming**
  - Lesson/value: Kindness / Courage / Sharing / Honesty / Perseverance — default **Kindness**, no custom-text option
- **Continue button**: stays `disabled`, but its color/style now reflects true readiness across all 6 selections (was previously always the "not ready" gray).
- **Out of scope**: genre-aware defaults, custom lesson text, finer length scale, illustrated-card style for these selectors (all logged in `docs/PRD.md` backlog), content-safety filtering (#16), story generation (#13).

## Tasks:

- [x] 🟩 **Step 1: Types & option data**
  - [x] 🟩 Add `StoryLength`, `ReadingLevel`, `Tone`, `Lesson` union types to `lib/types.ts`
  - [x] 🟩 New `lib/storyOptions.ts`: `{id, label}[]` list + a `DEFAULT_*` constant for each of the 4 categories

- [x] 🟩 **Step 2: Reusable selector UI**
  - [x] 🟩 `components/PillSelector.tsx` — generic pill/chip group (options, selected id, onSelect, label), selected/unselected visual state, keyboard-accessible buttons

- [x] 🟩 **Step 3: Page wiring**
  - [x] 🟩 `app/page.tsx`: 4 new `useState` hooks initialized to the fixed defaults
  - [x] 🟩 New "Customize your story" section rendering 4 `PillSelector` groups (Length, Reading level, Tone, Lesson/value)
  - [x] 🟩 Readiness check left as genre+character only (length/level/tone/lesson always hold a valid default, so there's no "incomplete" state for them to gate on) — Continue button's styling already reacts to this via existing `isReady`

- [ ] 🟨 **Step 4: Verify & review**
  - [x] 🟩 `/verify` — drive the real app (light + dark mode), confirm defaults, selection toggling, and Continue button style-only readiness change. Caught + fixed a dark-mode label contrast bug in `PillSelector.tsx` in the process.
  - [x] 🟩 `/code-review` — high effort, 8 finder angles + verification pass. No correctness bugs found. 2 minor cleanup notes (duplicated selected-state pill/card styling, partial type/array drift protection in the new option lists) accepted as known follow-ups, consistent with the precedent set on #4. Rejected 2 candidate findings (unmemoized re-renders, unified "story setup" state object) as premature optimization/abstraction against CLAUDE.md's "don't design for hypothetical future requirements."
  - [x] 🟩 `/security-review` — no vulnerabilities found (client-side-only, no new attack surface, no free-text/user input in this diff)
  - [x] 🟩 `/document` — `CHANGELOG.md` updated; `docs/architecture.md` component-tree and data-model diagrams extended to cover #8 (PillSelector, StoryLength/ReadingLevel/Tone/Lesson types)
  - [x] 🟩 On sign-off: closed #9, #10, #11, #12, and #8; moved all 5 board cards to Done

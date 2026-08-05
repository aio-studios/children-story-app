# Legibility Pass (#60) — Implementation Plan

**Overall Progress:** `100%` — code + verify + review + docs complete. Awaiting Sarthak's UAT sign-off.

## TLDR
The app's type and cards read too small on a real phone (labels down to 9.6px). Introduce a **shared `--sk-fs-*` type scale** in `app/globals.css`, map every screen (Home, Setup, Reader) and the Tailwind-inline component sizes onto it, bump tap targets (pills, nav buttons, fields) to ~44px, and widen genre chips 58→66px so bigger labels don't wrap. Design approved in [docs/designs/legibility-pass-preview.html](../docs/designs/legibility-pass-preview.html).

## Critical Decisions
- **Shared token scale, not per-component bumps** — new `--sk-fs-*` tokens (2xs 11 / xs 12.5 / sm 14 / base 16 / lg 18 / xl 21 / 2xl 24, all in rem) so sizing can't silently drift small again.
- **rem-based** — respects the browser/OS minimum-font-size & zoom settings (best we can do for accessibility without adopting Dynamic Type text styles).
- **Reader gets a light touch only** — its body is already a comfortable 17px; nudge to 18px + ensure its buttons clear 44px, no restructure. Reader uses its own `--sr-*` system, so tokens stay scoped to the `--sk-*` world.
- **Genre chips widen 58→66px** (+ orb/img 34→40px) so "Adventure" at the larger label doesn't wrap.
- **No component-logic changes** — pure styling. Tailwind inline `text-xs`/`text-sm` on cards/pills swap to token-driven classes/vars.

## Token scale (add to `:root` in globals.css)
| token | value | px |
|---|---|---|
| `--sk-fs-2xs` | 0.6875rem | 11 |
| `--sk-fs-xs` | 0.78rem | 12.5 |
| `--sk-fs-sm` | 0.875rem | 14 |
| `--sk-fs-base` | 1rem | 16 |
| `--sk-fs-lg` | 1.125rem | 18 |
| `--sk-fs-xl` | 1.3125rem | 21 |
| `--sk-fs-2xl` | 1.5rem | 24 |

## Tasks:

- [x] 🟩 **Step 1: Define the type-scale tokens**
  - [x] 🟩 Add `--sk-fs-*` tokens to the `:root` block in `app/globals.css` (with a short WHY comment)

- [x] 🟩 **Step 2: Home screen → tokens**
  - [x] 🟩 `.sk-msg` 0.85rem→base; `.sk-hero .sk-eyebrow` 0.65→2xs; `.sk-hero .sk-title` 1.05→xl; `.sk-hero .sk-sub` 0.72→sm
  - [x] 🟩 `.sk-shelf-title` 0.95→lg; `.sk-shelf-card` 0.7→sm; grow card 104×128→112×140
  - [x] 🟩 `.sk-genre-chip` width 58→66px, img 34→40px; `.sk-genre-chip span` 0.6→xs

- [x] 🟩 **Step 3: Setup stepper → tokens + tap targets**
  - [x] 🟩 `.sk-stepper-labels span` 0.63→xs; `.sk-step-heading` 1.15→2xl; `.sk-step-count` 0.78→xs
  - [x] 🟩 `.sk-pill` 0.875→base + padding to ~44px min-height; `.sk-field` 0.875→base + padding to ~44px
  - [x] 🟩 `.sk-nav-btn` 0.85→`--sk-fs-navbtn` (15px) + padding to ~44px
  - [x] 🟩 `.sk-illus-title` →base; `.sk-illus-desc` 0.78→sm; `.sk-illus-tag` 0.62→2xs
  - [x] 🟩 `.sk-select-card` inline text: `CharacterCard`/`GenreCard` `text-sm`→base name, `text-xs`→sm desc; `PillSelector` label `text-sm`→base

- [x] 🟩 **Step 4: Reader (light touch)**
  - [x] 🟩 `.story-reader-story p` 17→18px; confirm `.story-reader-btn` clears ~44px (bump padding/font if short)

- [x] 🟩 **Step 5: Verify & review**
  - [x] 🟩 `/verify` at iPhone 12 Pro viewport (390px), light + dark — PASS: no overflow (390=390), no chip wrap, all tap targets 48–50px, sizes correct (genre 12.5 / stepper 12.5 / heading 24 / pill 16 / story 18)
  - [x] 🟩 `/code-review` (2 low/cosmetic findings, accepted) + `/security-review` (no findings) + `/document` (CHANGELOG updated)

> **Impl note:** scale defined as Tailwind v4 `@theme` `--text-*` tokens (micro/caption/note/body/heading/title/display) — one source generating both utilities (`text-body`, …) and `var(--text-*)`, rather than plain `--sk-fs-*` props. Nav buttons landed at `--text-body` (16px) vs. the preview's 15px, to stay on-scale.

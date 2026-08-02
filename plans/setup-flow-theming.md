# Setup Flow Theming (#43) — Implementation Plan

**Overall Progress:** `100%` — shipped. UAT signed off 2026-08-02 (3 follow-up fixes: stepper line-through-icon + thicker bar, custom-genre placeholder clipping, custom-character draft persistence).

## TLDR
The Day 2 redesign themed the app shell, Home, and Reader with `--sk-*` tokens, but the setup steps (Genre / Character / Customize) were never migrated — they still use hardcoded Day-1 blue/gray/white Tailwind, so in dark mode the core flow renders as stark white cards + blue pills inside a dark-brown page. This migrates all 7 setup components to the `--sk-*` system via three shared CSS classes, so selection state is brand-bronze and everything tracks light/dark like the rest of the app. Approved design: [docs/designs/setup-flow-theming-preview.html](../docs/designs/setup-flow-theming-preview.html).

## Critical Decisions
- **Shared CSS classes, not per-component Tailwind** — add `.sk-select-card`, `.sk-pill`, `.sk-field` to `app/globals.css`. Themed once via tokens; every control opts in. Matches how the rest of the app is already styled (globals.css classes, not inline color utilities) and kills the copy-pasted blue/gray strings across 7 files.
- **Selection state = brand-bronze** — `2px solid var(--sk-brand)` border + `var(--sk-brand-wash)` fill (matches stepper done-dots & nav buttons). Selected text stays `--sk-ink`, not a colored text (readable on wash in both themes; old `text-blue-900` muddied in dark).
- **Genre orbs use each genre's own accent** — reuse the existing `--accent-light`/`--accent-dark` → `--accent` convention (set inline per-instance, resolved by media query) already used by Home's hero/shelf/chip, replacing the off-palette `from-blue-300 to-purple-300`. Character/custom orbs use a neutral brand-tinted fill (was `bg-gray-100`).
- **No behavior/markup/API changes** — pure visual migration. Component props, state, and structure stay identical; only className strings and the orb accent wiring change.

## Tasks:

- [x] 🟩 **Step 1: Add shared token-based classes to `app/globals.css`**
  - [x] 🟩 `.sk-select-card` (+ `:hover`, `[aria-*]`/selected variant) — Genre/Character tiles
  - [x] 🟩 `.sk-pill` (+ hover/selected) — Length/Reading-level/Tone/Lesson pills
  - [x] 🟩 `.sk-field` (+ placeholder) — text inputs & textareas
  - [x] 🟩 `.sk-select-orb` accent-gradient class + neutral character-orb variant, reusing the `--accent-light`/`--accent-dark` → `--accent` convention
  - [x] 🟩 Optional `.sk-form-panel` for the custom-character selected container

- [x] 🟩 **Step 2: Migrate `PillSelector.tsx`** (highest leverage — shared by Length/Reading/Tone/Lesson)
  - [x] 🟩 Replace blue/gray pill classes with `.sk-pill` + selected state

- [x] 🟩 **Step 3: Migrate `LessonSelector.tsx`**
  - [x] 🟩 "Type your own" pill → `.sk-pill`; custom input → `.sk-field`

- [x] 🟩 **Step 4: Migrate `GenreCard.tsx`**
  - [x] 🟩 Card → `.sk-select-card`; orb → accent gradient using `genre.accent`; label text → ink

- [x] 🟩 **Step 5: Migrate `CharacterCard.tsx`**
  - [x] 🟩 Card → `.sk-select-card`; neutral orb; name/desc → ink/ink-soft

- [x] 🟩 **Step 6: Migrate `CustomGenreCard.tsx`**
  - [x] 🟩 Card → `.sk-select-card` (text-cursor container); input → `.sk-field`; neutral orb

- [x] 🟩 **Step 7: Migrate `CustomCharacterForm.tsx`**
  - [x] 🟩 Panel → `.sk-form-panel`; labels → ink; inputs/textarea → `.sk-field`

- [x] 🟩 **Step 8: Migrate `CharacterSelector.tsx`**
  - [x] 🟩 Inline "Create your own" tile → `.sk-select-card`; blurb → ink-soft

- [x] 🟩 **Step 9: Verify & review**
  - [x] 🟩 `/verify` — drove Genre→Character→Customize in light + dark at iPhone 12 Pro; no blue/white leftovers, bronze selection reads clearly, per-genre orb accents confirmed
  - [x] 🟩 `/code-review` (2 low-severity CSS-cascade findings, both fixed) + `/security-review` (no findings — pure styling diff)
  - [x] 🟩 `/document` (CHANGELOG.md updated); `docs/architecture.md` unchanged — no new components/routes/types
```

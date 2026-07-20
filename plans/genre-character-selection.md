# Genre & Character Selection — Implementation Plan

**Overall Progress:** `100%`

**GitHub issue:** [#4](https://github.com/aio-studios/children-story-app/issues/4) (sub-issues #5, #6, #7) — first feature of Epic 1 (#3, Day 1 MVP)

## TLDR
The first screen of the app: a parent picks a genre (from 5 presets or types their own), then picks a character (from 3 genre-specific presets or creates a custom one). This is also the very first code in the repo, so it includes scaffolding the Next.js project itself. No backend calls, no database — pure client-side selection state, ending in a disabled "Continue" button since the next steps (length/tone/lesson selectors, story generation) aren't built yet.

## Critical Decisions
- **Stack**: Next.js (App Router) + TypeScript + Tailwind — scaffolded fresh, merging into the existing repo without clobbering `README.md`, `CLAUDE.md`, `docs/`, `persona/`, `.env.example`, `.gitignore`.
- **State**: local React state only (`useState` in the page), no URL params/global store — matches Day 1's stateless architecture.
- **Genres**: 5 presets (Adventure, Fantasy, Animals, Bedtime, Sci-fi) + a 6th "type your own" free-text card.
- **Genre card animation**: idle continuous loop + a distinct "active" loop for 5s on click, then reverts to idle. Built now as a CSS keyframe animation on a placeholder shape/icon (not real GIF/video — format undecided). This keeps the interaction logic (click → temporary state → revert) identical to what real video/GIF assets will plug into later; swapping in real media is a follow-up, not a rebuild.
- **Post-genre content**: static, hand-written stage-setting blurb (1 per genre, 5 total) + 3 preset characters per genre (15 total: one male, one female, one non-human/animal gender-neutral), written as real placeholder content during implementation. Not live/AI-generated (flagged as a Day 2 candidate in `docs/PRD.md`).
- **Character cards**: no animation (unlike genre cards) — simple static placeholder visual (icon).
- **Custom character**: name + free-text traits + free-text description. Zero content-safety filtering here (that's separate issue #16) — only basic "required field" validation.
- **Defaults**: first genre and that genre's first preset character are pre-selected on load (per the "smart defaults" principle in `docs/PRD.md`). Switching genre resets character selection to the new genre's first preset.
- **Continue button**: always rendered, always disabled — no next screen exists yet.
- **Out of scope**: real media assets, #16 safety filtering, F3-F6 selectors, story generation, live-generated stage content.

## Tasks:

- [x] 🟩 **Step 1: Scaffold the Next.js project**
  - [x] 🟩 Run `create-next-app` (TypeScript, Tailwind, App Router, ESLint) into the repo root
  - [x] 🟩 Merge the generated `.gitignore` with the existing one (don't drop the current secrets-related entries)
  - [x] 🟩 Confirm `README.md`, `CLAUDE.md`, `docs/`, `persona/`, `.env.example`, `.env.local` are untouched
  - [x] 🟩 Verify `npm run dev` boots the default page

- [x] 🟩 **Step 2: Content data module**
  - [x] 🟩 Define a `Genre` type/list: id, label, and (for presets) a stage-setting blurb + 3 characters; the 6th "custom" entry is just a flag, no blurb/characters
  - [x] 🟩 Write the 5 blurbs and 15 character names/descriptions (male/female/non-human per genre)
  - [x] 🟩 Define a `Character` type covering both preset and custom shapes (custom adds free-text traits + description)

- [x] 🟩 **Step 3: Genre selection UI**
  - [x] 🟩 `GenreCard` component: placeholder visual, idle CSS loop animation, on-click 5s "active" animation class then revert, selected/unselected visual state
  - [x] 🟩 6th card renders a text input instead of the animated visual
  - [x] 🟩 `GenreSelector` renders all 6 cards, holds/reports selected genre (or custom text) up to the page

- [x] 🟩 **Step 4: Character selection UI**
  - [x] 🟩 Once a genre is chosen, render its stage-setting blurb
  - [x] 🟩 `CharacterCard` component (static placeholder icon, no animation) for the 3 genre presets
  - [x] 🟩 Toggle to a `CustomCharacterForm` (name, traits, description fields) as a mutually-exclusive alternative to picking a preset
  - [x] 🟩 Basic required-field validation on the custom form only (no content filtering)

- [x] 🟩 **Step 5: Defaults & page wiring**
  - [x] 🟩 `app/page.tsx` holds selection state, pre-selects first genre + that genre's first preset character on mount
  - [x] 🟩 Changing genre resets character selection to the new genre's first preset
  - [x] 🟩 Disabled "Continue" button rendered once both a genre and a character (preset or valid custom) are set

- [x] 🟩 **Step 6: Verify & review**
  - [x] 🟩 `/verify` — 25/25 checks + 4/4 edge-case probes passed (Playwright-driven), no console errors
  - [x] 🟩 `/code-review` — high effort, 8 finder angles + verification pass. 5 correctness/dead-code bugs found and fixed (stale genre-card animation, custom-genre text data loss, redundant onSelect call, unreachable-but-silent lookup miss, unused constant); 4 cleanup/altitude notes accepted as known follow-ups (duplicated card styling, duplicate readiness-validation logic, animation-timer/asset-duration coupling, — the genre-reset scalability note was addressed as part of the fix itself). Re-verified after fixes: 6/6 checks + no regressions.
  - [x] 🟩 `/security-review` — no vulnerabilities found (client-side-only scaffolding, no backend/network/secrets surface yet)
  - [x] 🟩 `/document` — CHANGELOG.md updated

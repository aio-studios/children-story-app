# Custom Lesson/Value Option — Implementation Plan

**Overall Progress:** `100%`

**GitHub issue:** [#31](https://github.com/aio-studios/children-story-app/issues/31) (sub-issue of #8) — reverses a deliberate descope from #8, brought forward into MVP1

## TLDR
Add a "type your own" escape hatch to the Lesson/value selector, so a parent isn't limited to the 5 presets (Kindness/Courage/Sharing/Honesty/Perseverance). Mirrors the existing custom-genre/custom-character pattern: optional, doesn't change the default, doesn't add a required step.

## Critical Decisions
- **New type**: `LessonSelection` in `lib/types.ts` — `{ type: "preset"; lessonId: Lesson } | { type: "custom"; text: string }`, mirroring `GenreSelection`.
- **New component**: `components/LessonSelector.tsx` — hand-rolls its own row of 5 preset pills (same visual style as `PillSelector`'s pills, but not reused, matching how `CharacterSelector` hand-rolls its own grid instead of reusing `GenreCard`) + a 6th "Type your own" trigger pill inline in the same row. Selecting the trigger reveals a text input below the row (same placement as `CustomCharacterForm`).
- **`PillSelector.tsx` untouched** — still used as-is for length/reading level/tone.
- **State**: `app/page.tsx`'s `lesson` state becomes `LessonSelection` (was `Lesson`), seeded `{ type: "preset", lessonId: DEFAULT_LESSON }`. New `customLessonDraft` string state, mirroring `customGenreDraft`, so typed text survives toggling back to a preset and back.
- **Readiness**: new `isLessonReady` helper (parallel to `isGenreReady`/`isCharacterReady`) — empty custom text gates the Continue button's ready-styling. Length/reading level/tone remain excluded from `isReady` (still always valid).
- **Docs**: remove the now-stale "descoped" backlog bullet for this from `docs/PRD.md` (added during #8, now reversed).
- **Out of scope**: content-safety filtering on the new free-text field (#16, same as existing genre/character custom text), any change to `lib/storyOptions.ts`'s `LESSONS`/`DEFAULT_LESSON` (still the source of preset data).

## Tasks:

- [x] 🟩 **Step 1: Type**
  - [x] 🟩 Add `LessonSelection` union type to `lib/types.ts`

- [x] 🟩 **Step 2: `LessonSelector` component**
  - [x] 🟩 Row of 5 preset pills (styled like `PillSelector`'s buttons) + "Type your own" trigger pill, all inline
  - [x] 🟩 Conditional text input below the row when `type === "custom"`, using a draft value passed in (not owned internally) so the parent page can preserve it across toggles

- [x] 🟩 **Step 3: Page wiring**
  - [x] 🟩 `app/page.tsx`: replace `lesson: Lesson` state with `lessonSelection: LessonSelection` + `customLessonDraft: string`
  - [x] 🟩 `isLessonReady` helper; wire into the existing `isReady` calculation alongside genre/character
  - [x] 🟩 Swap `PillSelector` (Lesson row) for the new `LessonSelector` in the "Customize your story" section

- [x] 🟩 **Step 4: Docs cleanup**
  - [x] 🟩 Remove the stale "Custom 'type your own' lesson/value" backlog bullet from `docs/PRD.md`

- [ ] 🟨 **Step 5: Verify & review**
  - [x] 🟩 `/verify` — drive the real app (light + dark mode): default ready, empty custom text blocks readiness, typed text unblocks it, switching preset->custom preserves draft text, clearing text re-blocks. All passed, no bugs found.
  - [x] 🟩 `/code-review` — high effort, 8 finder angles + verification. No correctness bugs (all 3 correctness angles clean). 2 real findings fixed rather than accepted: `PillSelector` generalized (`selected: T | undefined` + a `children` slot for a trailing custom-trigger pill — a real, present 2nd use case, not a hypothetical one) and `LessonSelector` rewritten to compose it instead of duplicating its markup; also dropped a redundant `customDraft` prop in favor of deriving from `selection.text` directly, matching `GenreSelector`'s existing pattern. Re-verified after the refactor — all 6 behavioral checks still pass, layout unchanged.
  - [x] 🟩 `/security-review` — no vulnerabilities found (client-side-only, 4th unguarded free-text field of a kind already accepted, no new attack surface)
  - [x] 🟩 `/document` — `CHANGELOG.md` updated; `docs/architecture.md` component-tree and data-model diagrams extended for #31 (`LessonSelector`, `LessonSelection`)
  - [x] 🟩 On sign-off: closed #31, moved board card to Done

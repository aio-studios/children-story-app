# Story Reading Experience — Implementation Plan

**Overall Progress:** `100%`

**GitHub issues:** [#20](https://github.com/aio-studios/children-story-app/issues/20) (Story Reading Experience), [#21](https://github.com/aio-studios/children-story-app/issues/21) (Kid-legible reading view), [#22](https://github.com/aio-studios/children-story-app/issues/22) (Try again / regenerate) — bundled as one feature since they're the same screen.

## TLDR
Replace the current bare title+story dump on the success screen with a real, storybook-styled reading view: genre-tinted accent colors, a genre badge, Fredoka/Nunito typography, and a "Regenerate" action alongside "Back to setup". Design approved via artifact mockup before this plan: https://claude.ai/code/artifact/33addde4-9959-4885-8e38-8a7bec039bf4 (saved for lasting reference at [docs/designs/story-reading-experience-preview.html](../docs/designs/story-reading-experience-preview.html) - open directly in a browser).

## Critical Decisions
- **Accent color data**: extend the `Genre` type (`lib/types.ts`) with `accent: { light: string; dark: string }`, populated per genre in `lib/genres.ts` using the hex pairs approved in the artifact. Keeps color data colocated with the genre it themes — no new file.
- **Custom genre fallback**: a typed-in custom genre has no `genreId` to theme from. Badge falls back to a fixed neutral accent + "✨" icon + the user's own typed genre text as the label (truncated with CSS ellipsis if long) — rendered as plain text, never `dangerouslySetInnerHTML`.
- **Paragraph rendering**: the API returns `story` as one string, no format change needed. Client splits on blank-line boundaries (`\n\s*\n`) into separate `<p>` tags; if no blank lines are present, renders the whole string as a single paragraph. No backend/prompt changes.
- **Fonts scoped to this screen only**: Fredoka (title) + Nunito (body/UI), loaded via `next/font/google` inside the new `StoryReader` component and applied only to that component's root — rest of the app keeps its current font.
- **New component**: `components/StoryReader.tsx` encapsulates badge, title, ornamental flourish, paragraphs, and the two action buttons — matches the existing pattern of extracting `GenreSelector`/`CharacterSelector`/`LessonSelector` out of `app/page.tsx`.
- **Regenerate**: new button on the success screen, calls the existing `generateStory()` — no new fetch logic, no confirmation dialog (nothing is persisted yet, so losing the current story is low stakes). The error screen's existing "Try again" button/label is untouched — "Regenerate" is a separate, success-screen-only label since nothing failed there.
- **Styling mechanism**: new CSS in `app/globals.css` scoped under a `.story-reader` class, using `color-mix()` for tints/glow (same token approach as the artifact). Dark-mode accent swap via the `@media (prefers-color-scheme: dark)` pattern already used in this file — no `data-theme` toggle exists in the real app (that was an artifact-viewer-only affordance), so no selector needed for it.
- **No pagination**: continuous scroll for long stories, per Day 1 PRD scope.
- **Shared genre lookup**: added `getGenreById()` to `lib/genres.ts` during code review (3 independent review angles flagged the inline `GENRES.find()` in `StoryReader` as duplicating an existing pattern) — used by the new component, existing call sites left untouched (out of this PR's scope).

## Tasks:

- [x] 🟩 **Step 1: Genre accent data**
  - [x] 🟩 Add `accent: { light: string; dark: string }` to the `Genre` type in `lib/types.ts`
  - [x] 🟩 Populate accent hex pairs for all 5 genres in `lib/genres.ts` (values from the approved artifact)
  - [x] 🟩 Add a fixed neutral fallback accent constant for custom-genre entries

- [x] 🟩 **Step 2: Paragraph-splitting helper**
  - [x] 🟩 Small function splitting story text into paragraphs on blank-line boundaries, with a single-paragraph fallback (regex hardened to `\n\s*\n` during code review to also handle CRLF blank lines)

- [x] 🟩 **Step 3: `StoryReader` component**
  - [x] 🟩 New `components/StoryReader.tsx`: Fredoka + Nunito via `next/font/google`, scoped to this component
  - [x] 🟩 Genre badge (icon + label, or the custom-genre fallback), Fredoka title, flourish divider, paragraph-split story body
  - [x] 🟩 Action buttons: "Regenerate" (primary, filled with genre accent) + "Back to setup" (secondary, outlined)
  - [x] 🟩 Props: genre selection, title, story, `onRegenerate`, `onBackToSetup`

- [x] 🟩 **Step 4: Styling**
  - [x] 🟩 New `.story-reader`-scoped CSS in `app/globals.css`: page/canvas layout, accent `color-mix()` tokens, badge/flourish/button styles
  - [x] 🟩 Dark-mode accent swap via existing `prefers-color-scheme` pattern
  - [x] 🟩 `prefers-reduced-motion` — no transitions exist on this screen to guard, so no rule was needed (an unused one was caught and removed in code review)

- [x] 🟩 **Step 5: Wire into `app/page.tsx`**
  - [x] 🟩 Success branch renders `<StoryReader>` instead of the current inline `h1`/`p`/`BackToSetupButton`
  - [x] 🟩 Pass `genreSelection`, `generatedStory.title`/`story`, `generateStory` as `onRegenerate`, `backToSetup` as `onBackToSetup`
  - [x] 🟩 Confirm error screen is untouched (keeps its own "Try again" + `BackToSetupButton`)

- [x] 🟩 **Step 6: Verify & review**
  - [x] 🟩 `/verify` — golden path per preset genre (light + dark), custom-genre fallback badge, regenerate flow (success → loading → new success), a "longer" story's continuous scroll, back-to-setup still fully resets state — all passed
  - [x] 🟩 `/code-review` — 8-angle high-effort review, 5 findings confirmed and fixed: missing `.story-reader-badge-icon` CSS rule, CRLF gap in paragraph-split regex, dead reduced-motion rule, duplicated genre lookup (extracted to `getGenreById()`), unused Nunito font weight
  - [x] 🟩 `/security-review` — no vulnerabilities found (custom genre text renders via plain JSX interpolation, no `dangerouslySetInnerHTML`; accent colors always hardcoded, never derived from user input)
  - [x] 🟩 `/document` — `CHANGELOG.md` + `docs/architecture.md` updated
  - [x] 🟩 On sign-off: closed #20, #21, #22; moved board cards to Done

# AI Story Generation Engine — Implementation Plan

**Overall Progress:** `100%`

## Post-review polish
User feedback during UAT: loading screen and "Back to setup" felt too bare. Design-direction confirmed via quick preview options, then implemented:
- Loading state: bouncing pencil (✏️, CSS keyframe wiggle, same technique as the genre card animations) + classic 3-dot bounce, replacing static "Writing your story..." text.
- "Back to setup": new shared `BackToSetupButton` component - outlined secondary button matching "Try again"'s visual weight, replacing a bare underlined text link.
- Re-verified in light + dark mode, full regression suite re-run clean, no new dependency (pure CSS).
- Follow-up UAT feedback: pencil flipped horizontally (tip down-right instead of down-left) to read more naturally as "actively writing." Signed off.

**GitHub issue:** [#13](https://github.com/aio-studios/children-story-app/issues/13) — third feature of Epic 1 (Day 1 MVP), the step that makes Continue actually do something

## TLDR
A server-side API route takes the 6 setup selections (genre, character, length, reading level, tone, lesson) and generates a one-shot story via Claude Haiku. The Continue button goes live: click it, see a loading state, then a bare title+story dump (no reading-view polish — that's #20) or a friendly retry-able error. No content-safety filtering (#16), no regenerate-with-same-selections (#22), no rate limiting beyond a basic double-submit guard — all explicitly deferred.

## Critical Decisions
- **Route**: `app/api/generate-story/route.ts`, `POST`, non-streaming, model `claude-haiku-4-5`.
- **Trust boundary**: client sends selections (IDs for presets, raw text for custom); server resolves preset IDs against `lib/genres.ts`/`lib/storyOptions.ts` itself — never trusts client-sent labels/descriptions.
- **Structured output**: use `output_config.format` (JSON schema, `{title, story}`) via the SDK's structured-outputs support (Haiku 4.5 supports it) instead of parsing free-text — reliable, no regex/split fragility.
- **Prompt**: word-count target by length (Quick ~200-300 words, Longer ~800-1200), vocabulary/sentence guidance by reading level, tone + lesson as explicit instructions, genre/character as context. System prompt includes basic child-appropriate framing (defense-in-depth prompt engineering, not #16's filter layer).
- **Client state**: `app/page.tsx` gets `generationState` (`idle`/`loading`/`error`/`success`) + `generatedStory` + `generationError`. Continue is enabled when `isReady`, disables itself mid-flight (double-submit guard only).
- **Render**: same page, conditional — setup form (idle) → loading → bare success (title/story text + "back to setup" resetting to idle, selections untouched) or friendly error (message + retry button re-submitting the same selections).
- **Errors**: real error logged server-side (`console.error`), client only ever sees a generic kid-friendly message — never a raw stack trace/API error string.
- **New dependency**: `@anthropic-ai/sdk`.
- **Out of scope**: #16 (safety filtering), #20 (reading UI), #22 (regenerate), per-IP rate limiting, streaming.

## Tasks:

- [x] 🟩 **Step 1: Dependency & env**
  - [x] 🟩 `npm install @anthropic-ai/sdk` — installed clean. `npm audit` flagged 3 pre-existing vulns in Next.js's own transitive deps (postcss/sharp), unrelated to this change, fix requires a Next.js downgrade — noted, not acted on, out of scope for #13.
  - [x] 🟩 `ANTHROPIC_API_KEY` will be read via `process.env` only inside the server-only route handler (Step 3) — never a `NEXT_PUBLIC_` var, never returned in any response body

- [x] 🟩 **Step 2: Prompt builder**
  - [x] 🟩 `lib/storyPrompt.ts`: pure function(s) turning the 6 selections into a system prompt + user prompt, resolving preset IDs via `GENRES`/`READING_LEVELS`/`TONES`/`LESSONS`
  - [x] 🟩 Word-count/vocabulary/tone/lesson guidance encoded as described above

- [x] 🟩 **Step 3: API route**
  - [x] 🟩 `app/api/generate-story/route.ts`: parses + validates request body against the existing selection types (rejects unknown genre/character/lesson IDs, cross-genre character mismatches, malformed JSON, oversized custom text >300 chars), calls Claude via the prompt builder, structured-output `{title, story}` via `output_config.format` json_schema
  - [x] 🟩 Error handling: catches/logs real errors server-side (`console.error`), returns a generic `{ error: string }` with a non-200 status; manually smoke-tested happy path (preset + custom) and all 4 invalid-input cases — all correct, no leaked internals

- [x] 🟩 **Step 4: Client wiring**
  - [x] 🟩 `app/page.tsx`: `generationState`/`generatedStory`/`generationError` state; Continue button enabled+wired, disables while in flight
  - [x] 🟩 Conditional render: form (loading = button text/disabled change, no full swap) / bare success (title, story, "back to setup") / error (message, retry, "back to setup")

- [ ] 🟨 **Step 5: Verify & review**
  - [x] 🟩 `/verify` — drove the real app (light + dark, real API calls + mocked-error probe): loading/success/error states, "back to setup" preserves selections, readiness gate still holds, no leaked errors, no console errors. All passed, no bugs found.
  - [x] 🟩 `/code-review` — high effort, 8 finder angles + verification. 9 findings survived, 7 fixed: added basic in-memory per-IP rate limiter (route was completely open to bill-draining scripts), a synchronous re-entrancy guard against double-submit races, client-side `maxLength` matching the server's 300-char cap (was previously invisible-until-submit), derived `STORY_LENGTHS_VALUES` instead of hardcoding it, trimmed custom character fields, added a dedicated loading render branch (fixed a UX flash-to-form on retry), and cleared stale `generationError` on retry. 2 accepted as known debt (lookup-logic duplication across 5 call sites, 2 near-identical validator functions) — consistent with this project's established "don't abstract until it's real" precedent. Re-verified after fixes: all checks still pass, rate limiter and maxLength both manually confirmed working.
  - [x] 🟩 `/security-review` — dedicated identification sub-agent, no HIGH-confidence findings. Confirmed: API key never reaches client/logs, no SSRF surface, prompt injection has no escalation path (no tools exposed to the model), input validation matches client/server, no XSS (plain JSX text rendering). Noted (not filed, out of scope): the rate limiter's `x-forwarded-for` key is spoofable — fine as a naive-script stopgap, not real abuse defense.
  - [x] 🟩 `/document` — `CHANGELOG.md` updated; `docs/architecture.md` Day 1 flow diagram now marks #13 built / #16 not-yet-built, new code-map diagram for the generation flow, cost/rate-limiting note updated to reflect the actual stopgap limiter
  - [x] 🟩 On sign-off: closed #13, moved board card to Done

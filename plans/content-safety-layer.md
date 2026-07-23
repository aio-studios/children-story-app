# Content Safety Layer — Implementation Plan

**Overall Progress:** `100%`

**GitHub issue:** [#16](https://github.com/aio-studios/children-story-app/issues/16) (sub-issues #17 rules-based pre-filter, #18 Haiku classifier, #19 output check) — gate before public deploy. Follow-up richer messaging/logging tracked separately in [#35](https://github.com/aio-studios/children-story-app/issues/35), out of scope here.

## TLDR
Three-layer defense-in-depth on top of the existing `/api/generate-story` route: a free local rules-based filter, a bundled Haiku classifier call on custom input text, and a Haiku classifier call on the generated story before it's returned. Presets are never checked (fixed vocabulary we control). Any block returns a generic parent-facing message — no rich reasoning or persistent logging yet (that's #35, blocked on accounts/DB landing).

## Critical Decisions
- **Scope**: all three custom free-text fields — custom genre text, custom character (name/traits/description), custom lesson text. Presets skipped entirely.
- **Rules filter (#17)**: local blocklist/regex, no API call, runs first. Zero added cost or latency for the common case.
- **Classifier (#18)**: one bundled Haiku call covering all custom fields together per generation request, not one call per field — cuts classifier cost/latency ~3x. Runs on every custom submission that survives the rules filter (rules-based has no "confidence" signal to gate on).
- **Output check (#19)**: reuses the same classifier function against the generated story text, after generation, before the response is sent to the client.
- **Blocking UX**: generic message on any of the three layers (Day 1). No explicit reasoning, no persistent logging — deferred to #35.
- **Retry**: no new retry logic needed — the Anthropic SDK already retries connection errors/429/5xx automatically (`max_retries` default 2). Confirmed via `/claude-api` skill; nothing to build here.
- **Frontend prefill**: no change needed. Confirmed via code research that `app/page.tsx` already keeps all form state in memory across an error response (only `generationState`/`generatedStory`/`generationError` reset) — a block already lands the parent back on a fully-filled-in form.
- **Cost**: bundled input classifier (~$0.0004/story) + output classifier (~$0.001–0.002/story) on top of existing generation cost (~$0.003–0.008/story), using Haiku 4.5 pricing ($1/$5 per MTok). Accepted as negligible at current volume.

## Tasks:

- [x] 🟩 **Step 1: Rules-based pre-filter (#17)**
  - [x] 🟩 New `lib/contentSafety.ts`: blocklist/pattern list + `containsBlockedContent(text: string): boolean`
  - [x] 🟩 Wire into `app/api/generate-story/route.ts`: after `validateSelections`, collect any custom-text fields present (genre/character/lesson) via new `collectCustomText`, run the filter before anything else. On a match, return 400 with a new `SAFETY_BLOCK_MESSAGE` — no Claude call made.

- [x] 🟩 **Step 2: Haiku input classifier (#18)**
  - [x] 🟩 In `lib/contentSafety.ts`: `classifySafety(text: string): Promise<{ safe: boolean }>` — `claude-haiku-4-5`, structured output (`output_config.format`, small boolean-ish schema), short `max_tokens`
  - [x] 🟩 Wire into route: if custom text present and rules filter passed, bundle all custom fields into one labeled text blob and call `classifySafety`. On `safe: false`, return 400 `SAFETY_BLOCK_MESSAGE` — no generation call made.

- [x] 🟩 **Step 3: Output safety check (#19)**
  - [x] 🟩 After the existing `client.messages.create` call returns a story, call `classifySafety` again against the generated `story` text.
  - [x] 🟩 On `safe: false`, return 400 `SAFETY_BLOCK_MESSAGE` instead of the story — never send unsafe generated content to the client.

- [x] 🟩 **Step 4: Logging (Day 1 minimal)**
  - [x] 🟩 `console.warn` at each block point (which layer, no PII beyond dev debugging) — matches existing `console.error` pattern in the route. No persistence (that's #35).

- [x] 🟩 **Step 5: Verify & review**
  - [x] 🟩 `/verify` — drove the real app: preset-only golden path (no safety calls triggered), benign custom text (passes classifier), rules-filter block, and browser-driven error-state check in light/dark. Created `.claude/skills/verify/SKILL.md` for this project.
  - [x] 🟩 `/code-review` — 9 findings (high effort, 8 finder angles), all CONFIRMED, all fixed: title never safety-checked, wrong block message on preset-only output blocks, rate limit not scaled for 3x Claude calls, `collectCustomText` silent-bypass risk, classifier errors indistinguishable from generation errors, duplicate Anthropic client/parsing logic/model-id string.
  - [x] 🟩 `/security-review` — 2 vulnerabilities found and fixed: (1) generated title bypassed the output classifier entirely, (2) the classifier itself had no prompt-injection defense against the text it was judging. Fix verified live against a crafted injection payload that evaded the rules filter — correctly blocked post-fix.
  - [x] 🟩 `/document` — `CHANGELOG.md` (2026-07-22) + `docs/architecture.md` updated (safety-layer code map, technical-considerations note, rate-limit note)
  - [x] 🟩 On sign-off: closed #16, #17, #18, #19; moved all 4 board cards to Done

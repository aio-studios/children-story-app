# Interactive Branching Story Mode — Implementation Plan

**Overall Progress:** `100%`

Implements #37 (branching engine), #48 (▶ Continue), #49 (choice control), #50 (arc-budget bar).
Approved design: [`docs/designs/interactive-reader-wireframes.html`](../docs/designs/interactive-reader-wireframes.html) — **Direction A "Scroll & Reveal"**.

## TLDR
Add an **opt-in** Interactive mode where a story unfolds one **beat** at a time. The reader presses **▶ Continue** (storyteller decides) or picks **1 of 3 suggested directions / writes their own** (steer the plot). An **arc-budget** governs pacing toward a natural ending, shown as a progress bar. The classic one-shot flow is untouched. **No accounts/DB** — story state lives client-side (localStorage), re-injected into each step's prompt so the story stays consistent.

## Critical Decisions
- **Opt-in toggle in Setup** (mirrors `IllustrationToggle`) — classic one-shot path stays byte-for-byte unchanged; interactive is a deliberate choice.
- **Direction A layout** — story text accumulates on a growing page; persistent bottom dock with ▶ Continue + a "Choose ▾" expander (3 choices + write-your-own); thin progress bar under the header, **no beat counter**.
- **Combined single Haiku call per beat** returning `{ beatText, choices[3], isEnding }` — cheaper/faster than separate calls; ▶ and choices/free-text all hit the same endpoint (action differs).
- **Ranged arc budget** — Quick ≈ 4–6 beats, Longer ≈ 8–12. Prompt is told `current / range` and soft-steers toward resolution; **hard cap at max**; model emits `isEnding`. Bar fills toward the max and **snaps to 100% on ending**.
- **Client-held story-state** — locked character blueprint (from selections, no extra call) + arc state + beat history, re-injected each step to prevent drift. Persisted to the existing localStorage continue-slot so a refresh resumes.
- **Single cover** as today (up front if illustration on); per-beat images deferred to **#78**.
- **Reuse safety pipeline** — free-text "write your own" runs rules filter + input classifier before generation; every generated beat runs the output classifier.
- **Dedicated step rate-limiter** — the current 3/60s per-IP limit would block stepping; `/api/story-step` gets its own generous limiter (beats are cheap Haiku calls).

## Tasks

- [x] 🟩 **Step 1: Types & story-state model** (`lib/types.ts`)
  - [x] 🟩 `StoryMode = "classic" | "interactive"`
  - [x] 🟩 `CharacterBlueprint` (immutable: character description, genre, reading level, tone, lesson — derived from existing selections)
  - [x] 🟩 `ArcState { min: number; max: number; current: number }`
  - [x] 🟩 `InteractiveStory { title; blueprint; arc; beats: string[]; choices: string[]; ended: boolean }`
  - [x] 🟩 `StepAction = { kind: "continue" } | { kind: "choice"; text: string } | { kind: "freeText"; text: string }`

- [x] 🟩 **Step 2: Step prompt builder** (`lib/stepPrompt.ts`)
  - [x] 🟩 `LENGTH_BEAT_RANGE: Record<StoryLength, {min,max}>` (quick 4–6, longer 8–12)
  - [x] 🟩 `buildStepPrompt(story, action)` → `{ system, user }`: injects blueprint, full beat history, `beat N of ~min–max`, soft-steer + hard-cap-at-max instruction, and the requested action (continue / chosen direction / free-text)
  - [x] 🟩 Reuse `describeGenre`/`describeCharacter`/lesson helpers from `storyPrompt.ts` (export/share, don't duplicate)

- [x] 🟩 **Step 3: Dedicated step rate-limiter** (`lib/rateLimit.ts`)
  - [x] 🟩 Add `checkStepRateLimit(ip)` with its own prefix + higher ceiling (e.g. 15/60s), fail-open like story gen
  - [x] 🟩 Leave existing `checkRateLimit` (story start + image) untouched

- [x] 🟩 **Step 4: Step API route** (`app/api/story-step/route.ts`)
  - [x] 🟩 Validate body (story-state shape + action); rate-limit via `checkStepRateLimit`
  - [x] 🟩 On free-text action: `containsBlockedContent` + `classifySafety` before generating (fail as CUSTOM_ENTRY block)
  - [x] 🟩 One Haiku call with JSON schema `{ beatText, choices: string[3], isEnding }`; hard-cap: force `isEnding` when `current >= max`
  - [x] 🟩 Output `classifySafety` on `beatText`; reuse the route's existing generic/error message conventions

- [x] 🟩 **Step 5: Client persistence** (`lib/storyHistory.ts`)
  - [x] 🟩 Extend the continue-slot to optionally hold `InteractiveStory` + `mode` (bump validation shape, keep back-compat for classic slots)
  - [x] 🟩 Helpers: save/advance/regenerate-last-beat (drop last beat + re-request), all localStorage-safe (try/catch like today)

- [x] 🟩 **Step 6: Setup mode toggle** (`components/StoryModeToggle.tsx`)
  - [x] 🟩 New toggle mirroring `IllustrationToggle` (classic ↔ interactive), placed in Setup step 3 ("Customize")
  - [x] 🟩 `mode` state in `app/page.tsx`; passed into generation

- [x] 🟩 **Step 7: Interactive reader UI** (`components/InteractiveStoryReader.tsx`)
  - [x] 🟩 Direction A: reuse `StoryReader` cover/title/prose look; accumulate beats as paragraphs
  - [x] 🟩 Progress bar under header (fill = `ended ? 100 : current/max`), no counter text
  - [x] 🟩 Bottom dock: ▶ Continue + "Choose ▾" expander → 3 choices + write-your-own input
  - [x] 🟩 Ending state: dock → "✦ The End ✦" + "Read again"; per-beat loading/disabled states; abandon-guard like classic
  - [x] 🟩 `prefers-reduced-motion` + focus-visible on all controls

- [x] 🟩 **Step 8: Wire into view machine** (`app/page.tsx`)
  - [x] 🟩 On finish in interactive mode: seed first beat (blueprint built client-side, first `/api/story-step` with `kind:"continue"`)
  - [x] 🟩 Step handler (continue/choice/free-text) → append beat, persist, snap progress on `isEnding`
  - [x] 🟩 Resume mid-story from continue-slot; regenerate = redo last beat; keep classic branches unchanged

- [x] 🟩 **Step 9: Styles** (`app/globals.css`)
  - [x] 🟩 Dock, ▶ button, choice chips, write-your-own, progress bar, "The End" — using existing `--sk-*`/accent tokens; light + dark; match the approved wireframe

- [ ] 🟥 **Step 10: Verify, review, document** (workflow tail)
  - [x] 🟩 `/verify` (engine/API verified end-to-end; UI pending your phone UAT) (start → step via ▶/choice/free-text → organic ending → resume → regenerate-last); classic mode regression check
  - [x] 🟩 `/code-review` + `/security-review` (esp. free-text injection into step prompt, rate-limit sizing)
  - [x] 🟩 `/document` (CHANGELOG.md) + `docs/architecture.md` (new route, new state model, reader split)
  - [x] 🟩 UAT walkthrough; PASS 2026-08-05 (progress-bar-at-bottom accepted) — closing #37/#48/#49/#50, cards to Done

## Out of Scope (deferred, per agreed sequence)
Accounts/DB (#23) · per-beat premium images (#78) · landscape (#75) · PWA (#58).

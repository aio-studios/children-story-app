# Development Workflow

**Last updated:** 2026-07-23 22:14

Step-by-step checklist for any piece of work on this project, from a loose idea to a shipped, documented feature. Both I (Sarthak) and the CTO agent follow this — if a step gets skipped, call it out rather than quietly moving on.

## 1. Brainstorming & Ideation
- **Purpose:** figure out what to build and why, before it's a concrete task.
- Just talk it through — no skill required for the discussion itself.
- If researching best practices, competitors, or an unfamiliar tool would help, use the built-in `/deep-research` skill.
- For foundational/whole-product ideation (not a single feature), go deeper: list features, then functional and non-functional requirements, technical considerations, and architecture — captured in [`docs/PRD.md`](../docs/PRD.md) and [`docs/architecture.md`](../docs/architecture.md). Revisit these when scope changes significantly, not on every small feature.
- **Output:** an idea clear enough to become an issue (`/create-issue`), or well-defined enough to skip straight to exploration. For anything non-trivial, `/explore` and `/create-plan` should stay consistent with `docs/PRD.md`/`docs/architecture.md` rather than contradict them.

## 2. Issue Creation
- **Purpose:** capture the idea/bug/improvement as a tracked GitHub issue so it isn't lost.
- **Skill:** `/create-issue` (custom) — conversational capture in under 2 min, sets type (Epic/Feature/User Story/Bug/Task) and priority/effort labels, links as a sub-issue to an Epic when relevant.
- **Output:** an issue in `aio-studios/children-story-app`.

## 3. Exploration
- **Purpose:** understand the codebase and remove ambiguity before any code is written.
- **Skill:** `/explore` (custom) — investigates, asks clarifying questions, does NOT implement.
- **Output:** shared understanding, all open questions resolved.

## 4. Planning
- **Purpose:** turn the resolved exploration into a concrete, trackable plan.
- For anything visually significant (a new screen, a real visual-design pass, not a minor tweak): show a live, working design preview (an Artifact - real content, both light/dark, interactive if it clarifies a system like per-genre theming) and get explicit sign-off *before* `/create-plan` locks in implementation details. Save the approved mockup into `docs/designs/` so it outlives the session. Don't wait to be asked - offer this proactively once the visual direction is discussed, the same way `/code-review` and `/security-review` aren't asked for each time.
- **Skill:** `/create-plan` (custom) — produces `plans/<feature-slug>.md` with emoji status (🟩🟨🟥) and an overall progress %. Needs my confirmation before implementation starts.
- **Output:** a confirmed plan doc (and, for visual features, an approved design preview referenced by it).

## 5. Development
- **Purpose:** implement exactly what was planned, nothing more.
- No separate skill — implementation follows existing code patterns, and `/create-plan`'s own instructions keep the plan doc's status/progress % updated as steps complete.
- **Output:** working code + an up-to-date plan doc.

## 6. Testing
- **Purpose:** confirm the change actually works, not just that it compiles or tests pass.
- **Skills:** `/verify` (built-in) — drives the real app/flow end-to-end and checks the golden path plus edge cases. `/run` (built-in) launches/screenshots the app if it isn't already running.
- **Output:** confirmation it works, or a concrete list of what's broken.

## 7. Code & Security Review
- **Purpose:** catch correctness bugs, quality issues, and security problems before they ship.
- **Skills:** `/code-review` (built-in — correctness/simplification/efficiency) and `/security-review` (built-in — security-specific). Optionally `/simplify` (built-in) if the code works but feels overbuilt or duplicated.
- **Output:** findings fixed, or explicitly and knowingly accepted as out of scope.

## 8. Documentation
- **Purpose:** keep a truthful, current record of what changed.
- **Skill:** `/document` (custom) — updates `CHANGELOG.md` from the actual diff/code, grouped by day, each entry timestamped.
- Also update [`docs/architecture.md`](../docs/architecture.md) whenever a change alters structure worth diagramming — component tree, data model, or system flow (new/removed/rewired components, changed types, new API routes). Don't wait to be asked; check this every time, skip it only when nothing diagram-worthy changed.
- **Output:** updated `CHANGELOG.md` (and `docs/architecture.md` when structure changed).

## 9. UAT (User Acceptance Testing)
- **Purpose:** I personally try the feature as an end user before it's "done" — the one step no skill replaces.
- CTO should walk me through exactly what to click/try, including whatever edge cases it already checked in Testing, so I'm not guessing what to test.
- **Output:** my explicit sign-off, or a new issue via `/create-issue` if something's off.
- Once signed off: move the issue's card to "Done" on the [Storykins Roadmap board](https://github.com/orgs/aio-studios/projects/1) and close the issue(s) in GitHub — completed work doesn't sit in Todo. Do this without being asked.

## Ad hoc (used whenever relevant, not a fixed stage)
- **`/peer-review`** (custom) — if I paste review feedback from another tool/model, verify each finding against the real code before acting on it.
- **`/learning-opportunity`** (custom) — any time I want to understand something more deeply instead of continuing to ship.
- **`/deep-research`** (built-in) — deeper multi-source research during ideation or when evaluating a new tool/library for the tech stack.
- **Versioning** — after a significant milestone ships (an Epic closes, a showcase-worthy state is reached — not every small feature), tag the commit (`vX.Y.Z`, semver-ish) and create a [GitHub Release](https://github.com/aio-studios/children-story-app/releases) summarizing what's in it. Add a row to the Releases table in [README.md](../README.md). This preserves a citable "here's what v1 looked like" snapshot for showcasing, separate from the always-latest `main`.

## Quick Reference

| Stage | Skill(s) | Type |
|---|---|---|
| Brainstorming | (conversation), `/deep-research` | built-in |
| Issue creation | `/create-issue` | custom |
| Exploration | `/explore` | custom |
| Planning | `/create-plan` | custom |
| Development | (plan-driven, no skill) | — |
| Testing | `/verify`, `/run` | built-in |
| Review | `/code-review`, `/security-review`, `/simplify` | built-in |
| Documentation | `/document` | custom |
| UAT | (manual, CTO-guided) | — |
| Peer review | `/peer-review` | custom |
| Learning | `/learning-opportunity` | custom |

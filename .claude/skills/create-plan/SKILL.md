---
name: create-plan
description: Turn a fully-explored feature/bug discussion (after /explore) into a persisted, progress-tracked implementation plan document, then implement against it. Use once all clarifying questions from /explore are resolved.
---

# Plan Creation Stage

Based on the full exploration exchange, produce a markdown plan document at `plans/<feature-slug>.md` (create the `plans/` directory if it doesn't exist).

Requirements for the plan:

- Include clear, minimal, concise steps.
- Track the status of each step using these emojis:
  - 🟩 Done
  - 🟨 In Progress
  - 🟥 To Do
- Include dynamic tracking of overall progress percentage (at top).
- Do NOT add extra scope or unnecessary complexity beyond explicitly clarified details.
- Steps should be modular, elegant, minimal, and integrate seamlessly within the existing codebase.

Markdown Template:

```
# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Short summary of what we're building and why.

## Critical Decisions
Key architectural/implementation choices made during exploration:
- Decision 1: [choice] - [brief rationale]
- Decision 2: [choice] - [brief rationale]

## Tasks:

- [ ] 🟥 **Step 1: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2

- [ ] 🟥 **Step 2: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2
```

Writing the plan is not implementation yet — show it and get confirmation before building anything. No extra complexity or extra scope beyond what was discussed in `/explore`.

## Implementation (once the plan is confirmed)

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- Include comments only where the WHY is non-obvious — no narrating what the code already says.
- As each step/subtask completes, update this same plan document's emoji status and the overall progress percentage — don't let it go stale.
- Once implementation is done, this is the point to run `/code-review` and `/security-review` (correctness/quality and security respectively), and `/verify` to confirm it actually works end-to-end.

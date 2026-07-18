---
name: peer-review
description: Critically evaluate external code-review feedback (pasted from another model, tool, or reviewer) against the actual codebase before accepting it. Use when the user pastes review findings from an outside source and wants them verified rather than applied blindly.
---

# Peer Review Evaluation

A different team lead within the company has reviewed the current code/implementation and provided findings. Important context:

- **They have less context than you** on this project's history and decisions.
- **You are the team lead** - don't accept findings at face value.
- Your job is to critically evaluate each finding.

Findings from peer review:

[PASTE FEEDBACK FROM OTHER MODEL]

---

For EACH finding above:

1. **Verify it exists** - Actually check the code. Does this issue/bug really exist?
2. **If it doesn't exist** - Explain clearly why (maybe it's already handled, or they misunderstood the architecture).
3. **If it does exist** - Assess severity and add to the fix plan.

After analysis, provide:
- Summary of valid findings (confirmed issues)
- Summary of invalid findings (with explanations)
- Prioritized action plan for confirmed issues

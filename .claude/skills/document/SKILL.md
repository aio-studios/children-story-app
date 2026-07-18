---
name: document
description: Update CHANGELOG.md after code changes by reading the actual diff and current implementation, not by trusting existing docs. Use after a feature/fix is implemented and verified, before considering the work fully done.
---

# Update Documentation Task

Updating documentation after code changes.

## 1. Identify Changes
- Check git diff or recent commits for modified files.
- Identify which features/modules were changed.
- Note any new files, deleted files, or renamed files.

## 2. Verify Current Implementation
**CRITICAL**: DO NOT trust existing documentation. Read the actual code.

For each changed file:
- Read the current implementation.
- Understand actual behavior (not documented behavior).
- Note any discrepancies with existing docs.

## 3. Update Relevant Documentation

- **CHANGELOG.md**: Add entry under "Unreleased" section (create the file using Keep a Changelog format if it doesn't exist yet).
  - Use categories: Added, Changed, Fixed, Security, Removed.
  - Be concise, user-facing language.

## 4. Documentation Style Rules

✅ Concise - sacrifice grammar for brevity.
✅ Practical - examples over theory.
✅ Accurate - code verified, not assumed.
✅ Current - matches actual implementation.

❌ No enterprise fluff.
❌ No outdated information.
❌ No assumptions without verification.

## 5. Ask if Uncertain

If unsure about intent behind a change or user-facing impact, ask the user - don't guess.

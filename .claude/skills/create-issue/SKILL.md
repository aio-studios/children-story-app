---
name: create-issue
description: Capture a bug, feature idea, or improvement as a GitHub issue in under 2 minutes while the user is mid-development. Use when the user reports something broken, suggests a feature, or wants to note something to revisit later without derailing current work.
---

# Create Issue

User is mid-development and thought of a bug/feature/improvement. Capture it fast so they can keep working.

## Your Goal

Create a complete issue with:
- Clear title
- TL;DR of what this is about
- Current state vs expected outcome
- Relevant files that need touching
- Risk/notes if applicable
- Proper type/priority/effort labels

## How to Get There

**Ask questions** to fill gaps - be concise, respect the user's time. They're mid-flow and want to capture this quickly. Usually need:
- What's the issue/feature
- Current behavior vs desired behavior
- Type (bug/feature/improvement) and priority if not obvious

Keep questions brief. One message with 2-3 targeted questions beats multiple back-and-forths.

**Search for context** only when helpful:
- Web search for best practices if it's a complex feature
- Grep codebase to find relevant files
- Note any risks or dependencies you spot

**Skip what's obvious** - If it's a straightforward bug, don't search web. If type/priority is clear from description, don't ask.

**Keep it fast** - Total exchange under 2min. Be conversational but brief. Get what you need, create ticket, done.

## Behavior Rules

- Be conversational - ask what makes sense, not a checklist
- Default priority: normal, effort: medium (ask only if unclear)
- Max 3 files in context - most relevant only
- Bullet points over paragraphs

## Implementation

Issues are created with `gh issue create`, run from inside this repo (gh infers the repo from the local git remote, so no `-R` needed).

**Type** — maps to GitHub's native Issue Type field (org: aio-studios). Pick the closest fit:
- `Epic` - large body of work spanning multiple Features/User Stories
- `Feature` - a request, idea, or new functionality
- `User Story` - a user-facing piece of functionality, usually part of a Feature or Epic
- `Bug` - something broken
- `Task` - a specific, self-contained piece of work

**Labels** — priority and effort aren't native GitHub fields, so use these repo labels:
- `priority: urgent` / `priority: high` / `priority: normal` (default) / `priority: low`
- `effort: small` / `effort: medium` (default) / `effort: large`

**Hierarchy** — if this issue is a child of an existing Epic/Feature, pass `--parent <issue-number-or-url>` to link it as a sub-issue.

Command shape:

```
gh issue create \
  --title "<clear title>" \
  --body "<TL;DR, current vs expected, relevant files, risks/notes>" \
  --type "<Epic|Feature|User Story|Bug|Task>" \
  --label "priority: normal,effort: medium" \
  [--parent <number>]
```

After creating it, share the issue URL back to the user and get back out of the way.

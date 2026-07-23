# Storykins *(working title — not final)*

**Last updated:** 2026-07-22 23:35
**Status:** Day 1 (MVP) shipped and live — [try it](https://children-story-app-lac.vercel.app/). Day 2 (accounts, ongoing conversation) not started.

## Vision

Character.AI-style interactive storytelling, but built for kids and families instead of adults. A parent (or kid) picks a genre, builds or picks a character — often modeled on their own child to make it personal and engaging — and gets an AI-generated story built around it. Longer term, the character talks back.

## Why

Character-driven AI chat apps already exist and are popular, but nearly all of them are adult-oriented. There's an opening for the same core idea — pick/build a character, get a story, eventually converse with it — done specifically for a family/kid audience: safe content, simple UI a kid can use, and a parent-friendly character-creation flow.

## Roadmap

### Day 1 (MVP)
- Select a genre.
- Select a character, or create your own (e.g. based on your kid).
- Select story length, reading level, tone/mood, and a lesson/value the story should carry.
- Get a one-shot AI-generated story built around all of the above.
- Stateless — no accounts, nothing saved yet. Optimized to be the fastest path to a working, demoable product.

See [docs/PRD.md](docs/PRD.md) for the full feature list, including a "Future Ideas" backlog (choose-your-own-adventure branching, character memory, voice/illustration style choice, printable keepsakes, and more) captured but not yet scoped.

### Day 2 (must-have next)
- Ongoing back-and-forth conversation with the character (Character.AI-style), not just a single generated story.
- User accounts so characters and stories persist across visits instead of resetting every time.

### Later
- Image/video generation alongside the story.
- Text-to-speech and speech-to-text, with different tones/sounds, so the character feels animated rather than just text on a screen.
- Ads and/or paid plans to offset AI compute cost.
- Native iOS/Android apps, once the web app is solid — reusing the same backend, no rewrite needed there (see [docs/architecture.md](docs/architecture.md)).

## Tech Stack

See [persona/CTO.md](persona/CTO.md#tech-stack) for the decision and rationale. Summary: Next.js + Tailwind, Claude API for generation, Supabase for auth/DB once Day 2 needs persistence, hosted on Vercel.

## Documentation

- [docs/PRD.md](docs/PRD.md) - full feature list, functional and non-functional requirements
- [docs/architecture.md](docs/architecture.md) - technical considerations and system architecture

## Working With This Repo

This project is built collaboratively with Claude Code acting as CTO/developer — see [persona/CTO.md](persona/CTO.md) for how that's set up, and [persona/workflow.md](persona/workflow.md) for the step-by-step process (ideation → issue → explore → plan → build → test → review → document → UAT) used for every feature.

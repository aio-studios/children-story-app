# Product Requirements Document

**Last updated:** 2026-07-18 18:30

Detailed breakdown of [README.md](../README.md)'s roadmap into concrete features and requirements. This is the reference for what we're building; [architecture.md](architecture.md) covers how.

## Target Users & UX Ownership

Target age range: roughly 0-10, with a split in who operates the app:

- **Setup/selection (genre, character, length, reading level, tone, lesson)** is always parent-operated — normal, adult-usable form UI. This doesn't change in Day 2.
- **Under age ~3**: fully parent-driven end to end — parent also reads the story to the child. No child-facing UI needed.
- **Age ~3+**: parent still does setup, but the child is the intended reader/participant from there on. This means:
  - The Day 1 reading view (F8) should already use kid-friendly typography (larger text, simple layout) even though a parent chose the settings — a 3-year-old may be the one reading it.
  - The Day 2 conversation feature (F15) must be usable by a child directly — icon-forward, large touch targets, minimal reading required to operate the chat itself (separate from the story content, which does involve reading). Child-solo navigation of setup/selection is explicitly out of scope until later, not Day 2.

## Features

### Day 1 (MVP - stateless, one-shot)
| ID | Feature |
|---|---|
| F1 | Select a genre from a predefined list (e.g. adventure, fantasy, animals, bedtime, silly/comedy) |
| F2 | Pick a preset character, or create a custom one (name, traits, short appearance/personality description) |
| F3 | Select story length (e.g. quick bedtime ~2 min vs. longer adventure ~10 min) |
| F4 | Select reading level (toddler / early reader / independent reader vocabulary) |
| F5 | Select tone/mood (funny, calming/bedtime, exciting, heartwarming) |
| F6 | Select a lesson/value the story should carry (kindness, courage, sharing, etc.) |
| F7 | Generate a one-shot story incorporating all selections above |
| F8 | Read the generated story in a simple, mobile-friendly reading view, using kid-friendly typography since a young child (3+) may be the one reading it even though a parent set it up |
| F9 | Regenerate ("try again") if the result isn't liked |
| F10 | Age-appropriate content filtering on generated stories |
| F11 | Basic filtering on custom character input to block inappropriate names/descriptions before they reach the model |

### Day 2 (accounts + ongoing conversation)
| ID | Feature |
|---|---|
| F12 | Parent-owned account (sign up/login) |
| F13 | Save custom characters, reusable across sessions |
| F14 | Save/revisit past stories (a simple library view) |
| F15 | Ongoing back-and-forth conversation with the character (not just one story), UI designed for a child to operate directly - icon-forward, large touch targets, minimal reading required to use the chat itself |
| F16 | Conversation history persisted per character |

### Later
| ID | Feature |
|---|---|
| F17 | Image generation alongside the story/scene |
| F18 | Video generation (lower priority than images - cost/complexity) |
| F19 | Text-to-speech narration with selectable tones/voices |
| F20 | Speech-to-text input (so a kid can talk instead of type) |
| F21 | Monetization: ads and/or paid plans to offset AI compute cost |
| F22 | Usage caps/tiers tied to monetization (e.g. free-tier story limit per day) |
| F23 | Native iOS/Android apps (via Expo/React Native), reusing the same backend/Supabase project - web ships first, native comes after |

## Future Ideas / Backlog (not yet committed - reassess when we get there)

From an ideation pass on 2026-07-18. Not scoped into Day 2/Later yet, just captured so they aren't lost:

- **Choose-your-own-adventure branching** - mid-story decision points, a lightweight step toward full Day 2 conversation mode.
- **Character memory across stories** - the character "remembers" past adventures, extends F16.
- **"Continue tomorrow" mode** - good bedtime-routine hook, builds on Day 2 persistence.
- **Multi-language story generation** - useful for bilingual families.
- **Narrator voice choice** - extends F19, pick a voice personality rather than one default voice.
- **Illustration style choice** - extends F17 (e.g. watercolor, cartoon, classic storybook).
- **Ambient sound effects while reading** - cheap engagement win, doesn't need full TTS complexity.
- **Print/export as a keepsake PDF** - strong emotional stickiness for parents.
- **Photo-based avatars** ("make the character look like my kid") - flagged: uploading a child's photo to a third-party image API raises real privacy questions on top of the COPPA-style concerns already flagged below. Worth doing eventually, but as a deliberate decision, not a quick add.
- **Gamification/badges** - flagged: engagement mechanics aimed at maximizing time-in-app are a different, riskier thing when the audience is kids. If pursued, frame around encouraging reading/creativity, not addictive streaks/loops.

## Functional Requirements

- **FR-1**: User must select a genre before a story can be generated (F1).
- **FR-2**: User must select a preset character or complete all required custom-character fields before generating (F2).
- **FR-3**: User must select a story length before generating (F3).
- **FR-4**: User must select a reading level before generating (F4).
- **FR-5**: User must select a tone/mood before generating (F5).
- **FR-6**: User must select a lesson/value before generating (F6).
- **FR-7**: System generates a complete story server-side, incorporating all of FR-1 through FR-6, and returns it in one response for Day 1 (F7).
- **FR-8**: User can request a new story for the same selections without re-entering them (F9).
- **FR-9**: Every generated story passes through a content-safety check before being shown (F10).
- **FR-10**: Custom character text is checked against a filter before being sent to the model (F11).
- **FR-11** *(Day 2)*: User can create an account and log back in to see previously saved characters and stories (F12-F14).
- **FR-12** *(Day 2)*: User can send follow-up messages to a character and receive streamed, in-character responses (F15).
- **FR-13** *(Day 2)*: Conversation history loads correctly when a user reopens a saved character (F16).

## Non-Functional Requirements

- **Performance**: story generation should complete in well under ~10s so a young reader doesn't lose interest; Day 2 chat responses should stream (first token fast) rather than wait for the full response.
- **Content safety**: this is a kids' product - generated content and any user-entered text (custom character fields) must both be filtered. Treat this as a hard requirement, not a nice-to-have.
- **Privacy/legal (flagging - not yet resolved)**: if any user under 13 could be using the account directly (vs. a parent using it on the child's behalf), COPPA (US) and equivalent regulations elsewhere restrict data collection and *behavioral/targeted advertising* to children. This directly conflicts with F21 (ads) if not designed carefully. Recommendation once we reach that phase: keep accounts parent-owned, collect minimal data from the child (e.g. a nickname, not a real name), and use contextual (not behavioral/targeted) ads only, or skip ads in favor of a paid-plan-only model. Needs a real decision before F21 is built, not before Day 1/2.
- **Accessibility**: mobile-first, legible type sizes suitable for a parent reading aloud or a child (3+) reading independently, sufficient color contrast. Setup/selection UI can assume an adult operator; the reading view (Day 1) and chat UI (Day 2) must not.
- **Cost control**: default to the cheaper model tier (Claude Haiku) for generation; add basic rate limiting per user/IP before this is publicly shared, so a spike in usage can't produce a surprise bill (fits the "keep infra costs low" goal).
- **Reliability**: if the LLM API fails or times out, show a kid-friendly retry state, never a raw error/stack trace.
- **Security**: never expose the Claude/Supabase API keys to the client; all generation calls happen server-side (Next.js API routes).
- **Maintainability**: keep code simple and well-commented on non-obvious decisions, matching the conventions in [persona/CTO.md](../persona/CTO.md) - this is being built and maintained by a non-engineer with AI assistance, so simplicity beats cleverness.

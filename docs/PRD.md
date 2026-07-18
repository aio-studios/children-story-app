# Product Requirements Document

**Last updated:** 2026-07-18 17:50

Detailed breakdown of [README.md](../README.md)'s roadmap into concrete features and requirements. This is the reference for what we're building; [architecture.md](architecture.md) covers how.

## Features

### Day 1 (MVP - stateless, one-shot)
| ID | Feature |
|---|---|
| F1 | Select a genre from a predefined list (e.g. adventure, fantasy, animals, bedtime, silly/comedy) |
| F2 | Pick a preset character, or create a custom one (name, traits, short appearance/personality description) |
| F3 | Generate a one-shot story from the genre + character |
| F4 | Read the generated story in a simple, mobile-friendly reading view |
| F5 | Regenerate ("try again") if the result isn't liked |
| F6 | Age-appropriate content filtering on generated stories |
| F7 | Basic filtering on custom character input to block inappropriate names/descriptions before they reach the model |

### Day 2 (accounts + ongoing conversation)
| ID | Feature |
|---|---|
| F8 | Parent-owned account (sign up/login) |
| F9 | Save custom characters, reusable across sessions |
| F10 | Save/revisit past stories (a simple library view) |
| F11 | Ongoing back-and-forth conversation with the character (not just one story) |
| F12 | Conversation history persisted per character |

### Later
| ID | Feature |
|---|---|
| F13 | Image generation alongside the story/scene |
| F14 | Video generation (lower priority than images - cost/complexity) |
| F15 | Text-to-speech narration with selectable tones/voices |
| F16 | Speech-to-text input (so a kid can talk instead of type) |
| F17 | Monetization: ads and/or paid plans to offset AI compute cost |
| F18 | Usage caps/tiers tied to monetization (e.g. free-tier story limit per day) |

## Functional Requirements

- **FR-1**: User must select exactly one genre before a story can be generated (F1).
- **FR-2**: User must select a preset character or complete all required custom-character fields before generating (F2).
- **FR-3**: System generates a complete story server-side and returns it to the client in one response for Day 1 (F3).
- **FR-4**: User can request a new story for the same genre/character without re-entering selections (F5).
- **FR-5**: Every generated story passes through a content-safety check before being shown (F6).
- **FR-6**: Custom character text is checked against a blocklist/filter before being sent to the model (F7).
- **FR-7** *(Day 2)*: User can create an account and log back in to see previously saved characters and stories (F8-F10).
- **FR-8** *(Day 2)*: User can send follow-up messages to a character and receive streamed, in-character responses (F11).
- **FR-9** *(Day 2)*: Conversation history loads correctly when a user reopens a saved character (F12).

## Non-Functional Requirements

- **Performance**: story generation should complete in well under ~10s so a young reader doesn't lose interest; Day 2 chat responses should stream (first token fast) rather than wait for the full response.
- **Content safety**: this is a kids' product - generated content and any user-entered text (custom character fields) must both be filtered. Treat this as a hard requirement, not a nice-to-have.
- **Privacy/legal (flagging - not yet resolved)**: if any user under 13 could be using the account directly (vs. a parent using it on the child's behalf), COPPA (US) and equivalent regulations elsewhere restrict data collection and *behavioral/targeted advertising* to children. This directly conflicts with F17 (ads) if not designed carefully. Recommendation once we reach that phase: keep accounts parent-owned, collect minimal data from the child (e.g. a nickname, not a real name), and use contextual (not behavioral/targeted) ads only, or skip ads in favor of a paid-plan-only model. Needs a real decision before F17 is built, not before Day 1/2.
- **Accessibility**: mobile-first, legible type sizes suitable for a parent reading aloud or a child reading independently, sufficient color contrast.
- **Cost control**: default to the cheaper model tier (Claude Haiku) for generation; add basic rate limiting per user/IP before this is publicly shared, so a spike in usage can't produce a surprise bill (fits the "keep infra costs low" goal).
- **Reliability**: if the LLM API fails or times out, show a kid-friendly retry state, never a raw error/stack trace.
- **Security**: never expose the Claude/Supabase API keys to the client; all generation calls happen server-side (Next.js API routes).
- **Maintainability**: keep code simple and well-commented on non-obvious decisions, matching the conventions in [persona/CTO.md](../persona/CTO.md) - this is being built and maintained by a non-engineer with AI assistance, so simplicity beats cleverness.

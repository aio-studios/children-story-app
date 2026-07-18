# Architecture

**Last updated:** 2026-07-18 18:30

Technical design supporting [PRD.md](PRD.md). Stack decision itself lives in [persona/CTO.md](../persona/CTO.md#tech-stack); this doc covers how the pieces fit together and evolves as we build.

## Technical Considerations

- **Story generation & safety**: use a system prompt that constrains tone/content for a young audience, plus a lightweight keyword/pattern filter on custom character input as defense-in-depth (don't rely solely on the model's own judgment for a kids' product).
- **Streaming for Day 2 chat**: recommend the Vercel AI SDK (`ai` package) with its Anthropic provider - it's built for exactly this (streaming chat UI in Next.js) and comes from the same vendor as hosting, which keeps integration friction low.
- **Data model (Day 2, Supabase/Postgres)**:
  - `characters` - id, user_id, name, traits, appearance, created_at
  - `stories` - id, user_id, character_id, genre, content, created_at
  - `conversations` - id, character_id, messages (jsonb), created_at
  - Auth/users handled by Supabase's built-in `auth.users` - don't build a custom users table unless a real need shows up.
- **Cost/rate limiting**: track generations per user/IP and cap them before this is shared beyond just us - Anthropic API calls cost money per token and there's no paying customer yet to offset it.
- **Environment separation**: `.env.local` for local dev (gitignored, already set up), Vercel project environment variables for production - never share a single key across both carelessly.
- **Ads vs. children's privacy (Later phase)**: see the flagged NFR in PRD.md - this needs a real decision before F17 is built, not before Day 1/2.
- **Future native iOS/Android (post-web goal)**: no stack change needed now. Next.js API routes are plain HTTP endpoints, so a future Expo (React Native) app can call the exact same backend and Supabase project as-is - no backend rewrite. Supabase has an official React Native SDK, so Day 2 auth patterns carry over too. The UI layer (Tailwind) won't port directly to React Native and will need rebuilding per platform when that phase starts - normal and expected, not a problem to solve now. The one practice worth adopting from the start, at no extra cost: keep data-fetching/business logic in separate hooks/modules rather than embedded inside page components, so that logic (not just the backend) is reusable later too.

## Architecture Overview

### Day 1 (stateless)
```
Client (Next.js, mobile-first)
  -> selects genre + character
  -> POST /api/generate-story
       -> server-side call to Claude API (Haiku)
       -> content-safety check on output
  <- story text returned, rendered client-side
```
No database, no auth. Everything lives in the request/response cycle.

### Day 2 additions
```
Supabase Auth -> login/signup, session
Client -> authenticated API routes
  -> /api/characters (CRUD, saved to Postgres)
  -> /api/stories (CRUD, saved to Postgres)
  -> /api/chat (streaming, Vercel AI SDK + Claude, appends to conversations table)
```
Existing Day 1 generation flow is reused for the initial story; the conversation table extends it rather than replacing it.

### Later
- Image/video generation: separate API route calling an external provider (e.g. Replicate/fal.ai), decided when this phase starts.
- TTS/STT: separate integration point (e.g. ElevenLabs for TTS, browser Web Speech API or Whisper for STT), decided when this phase starts.
- Payments: Stripe, with webhook handling for subscription state; ties into the usage-cap logic from F18.

### Hosting
- Vercel: Next.js app + API routes.
- Supabase: managed Postgres + Auth (Day 2+).
- All secrets via environment variables (`.env.local` locally, Vercel project settings in production) - never committed.

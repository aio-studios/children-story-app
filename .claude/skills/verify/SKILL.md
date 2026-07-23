---
name: verify
description: Project-specific recipe for driving Storykins end-to-end (API + UI) during /verify.
---

# Verifying Storykins

## Launch
- `npm run dev` starts Next.js on port 3000. A long-lived dev server is often already running from a prior session — `npm run dev` in a fresh shell will detect the conflict and exit immediately; check `curl -o /dev/null -w "%{http_code}" http://localhost:3000` first before assuming you need to start one.
- `.env.local` holds `ANTHROPIC_API_KEY` — real Anthropic API calls work out of the box in dev.

## API surface
- `POST /api/generate-story` is the only backend route. Hit it directly with `curl` for backend-only changes (safety layer, prompt building, validation) — this is exactly what the browser's `fetch` call does, no need to drive the UI for pure API-layer changes.
- Preset genre/character/lesson IDs live in `lib/genres.ts` (e.g. `adventure`/`finn`) and `lib/storyOptions.ts` (`LESSONS`) — grab real IDs from there rather than guessing, `validateSelections` rejects anything not in those lists.
- Server-side `console.log`/`console.warn`/`console.error` from the API route show up in `.next/dev/logs/next-development.log` (structured JSON lines, `source: "Server"`) — tail this to confirm which code path fired instead of guessing from the HTTP response alone.
- Rate limit is 3 requests/min per IP, and **every attempt counts toward the window even when it gets blocked** (`isRateLimited()` records the timestamp before checking it). Don't poll the endpoint in a retry loop waiting for the window to clear — each poll re-triggers the limit and the loop never exits. If you hit the limit, stop calling the endpoint entirely and wait out a plain 60s sleep (`ScheduleWakeup`/background `sleep`, not a curl-in-a-loop), then make exactly one request.

## UI surface
- Single-page flow in `app/page.tsx`. Key states: `idle` → `loading` (pencil animation) → `error` (message + "Try again"/"Back to setup") → `success`.
- Custom character form: click "Create your own" under character selection, then fill labeled inputs `Name` / `Traits` / `Appearance / personality description`.
- The "Continue" button is the generate trigger (disabled until `isReady`) — no separate confirm step.
- Form state is never cleared on error or "Back to setup" — only `generationState`/`generatedStory`/`generationError` reset. A block or failure naturally leaves the form filled in; no explicit prefill logic to test.
- Dark mode is OS-level `prefers-color-scheme` only (see `app/globals.css`) — there is no in-app toggle and no `dark:` Tailwind classes on these components yet. Playwright: `chromium.launch()` then `newPage({ colorScheme: "dark" })`.
- This is a mobile-first app — test at an exact real device viewport, not an approximate width. Playwright's `devices['iPhone 12 Pro']` (390×844) caught a button-wrapping/height bug on the Story Reading Experience screen that an approximate 420px-wide viewport missed entirely (390px was just narrow enough to wrap a button label that 420px had room for). `import { devices } from "playwright"`, spread `{ ...devices['iPhone 12 Pro'], colorScheme: ... }` into `newPage()`.

## Playwright gotcha
- `npx -p playwright node script.mjs` does NOT make `import { chromium } from "playwright"` resolve in an ESM script (no node_modules in the current dir). Instead: `npm init -y && npm install playwright --no-save` in the scratch dir first, then `node script.mjs` directly. `npx playwright --version` alone works fine (that's just the CLI binary, different from the importable package).

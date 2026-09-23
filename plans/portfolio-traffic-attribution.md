# Portfolio Traffic Attribution — Implementation Plan

**Overall Progress:** `90%` — built, verified locally, reviewed; post-deploy dashboard check pending

**Issue:** [#96](https://github.com/aio-studios/children-story-app/issues/96)
**Branch:** `claude/gifted-bohr-cwzlo4` (off `main`)
**Last updated:** 2026-09-23

## TLDR

The app is on Sarthak's resume. Vercel Web Analytics is anonymous, so today every visit collapses
into one number and Sarthak's own testing is mixed in with it. Two small pieces make the signal
readable:

1. **Per-application links** — `/r/<anything>` renders, gets counted as its own row in Analytics,
   then quietly forwards to `/`. A hit on `/r/acme` means the Acme application was opened.
2. **Ignore own traffic** — visit any page once with `?notrack=1` on each personal device; that
   browser is never counted again (`?notrack=0` undoes it).

## Critical Decisions

- **Any slug is accepted, no allowlist** — minting a link needs no code change or deploy, and
  employer names never land in the public repo. Cost: a typo'd link still records (under the typo).
- **Client-side forward, not a server redirect** — a 307 means the page never renders, the Analytics
  beacon never fires, and the link silently logs zero. Verified in `@vercel/analytics` source: the
  Next wrapper queues `pageview({ path: "/r/acme" })` on mount, so the later `router.replace('/')`
  can't overwrite the recorded path.
- **`/r/*` is `noindex`** — these are private tracking URLs; they shouldn't show up in search.
- **Opt-out via a `?notrack=1` link, stored in `localStorage` (`va-disable`)** — works on a phone
  without dev tools. Read inside Analytics' `beforeSend`, which needs a small `"use client"` wrapper
  because `app/layout.tsx` is a Server Component and can't pass a function prop.
- **Speed Insights untouched** — it measures performance, not visitors; own visits don't distort it.

## Tasks:

- [x] 🟩 **Step 1: Own-traffic opt-out**
  - [x] 🟩 `components/SiteAnalytics.tsx` (`"use client"`): on mount, `?notrack=1|0` sets/clears
        `va-disable`; wraps `<Analytics beforeSend>` returning `null` when the flag is set.
        `localStorage` access wrapped in try/catch (Safari private mode throws).
  - [x] 🟩 Swap `<Analytics />` for `<SiteAnalytics />` in `app/layout.tsx`

- [x] 🟩 **Step 2: Tracking links**
  - [x] 🟩 `app/r/[slug]/page.tsx` — server component exporting `robots: { index: false }` metadata,
        renders the client forwarder
  - [x] 🟩 Client forwarder: `router.replace('/')` on mount, minimal "Opening Storykins…" fallback
        text for the split second it's visible

- [x] 🟩 **Step 3: Docs**
  - [x] 🟩 README: how to mint a link, how to opt a device out, and the caveats (ad blockers drop
        hits; zero hits ≠ nobody looked; visitor counts are per-device-per-day)

- [ ] 🟨 **Step 4: Verify + review + document**
  - [x] 🟩 `/verify`: `/r/test` forwards to `/`, the pageview request carries `/r/test`, `noindex`
        present, `?notrack=1` suppresses the request, `?notrack=0` restores it
  - [x] 🟩 `/code-review`, `/security-review`, `/document`
  - [ ] 🟥 Post-deploy (needs Sarthak): open a test link from a non-opted-out device, confirm it shows
        as its own row in the Analytics **Pages** panel (not merged into a `/r/[slug]` route row)

## Verification notes (2026-09-23)

- 28/28 Playwright checks passed on a production build, iPhone 12 Pro, light + dark.
- Vercel's real tracking script is blocked by the sandbox's network policy, so a stand-in script
  replayed what our code queues. That proves the queued path is `/r/<slug>` and `beforeSend` drops
  opted-out visits, but not how Vercel's dashboard groups it — hence the post-deploy check above.
- A tracking-link hit also records a `/` pageview (the forward lands on the real landing page).

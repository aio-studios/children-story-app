# Landing Page — Implementation Plan

**Overall Progress:** `96%` — desktop UAT rounds 1–2 applied; mobile UAT outstanding

## ✅ Unblocked (was #99)

[#99](https://github.com/aio-studios/children-story-app/issues/99) turned out to be **two stacked
faults**: the Anthropic key was invalid (401 `authentication_error`) *and* the account had no credit
(400 `invalid_request_error`). Key rotated and credits added 2026-09-05; generation verified working
locally. **Production still needs the new key in Vercel env vars (Production + Preview) and a
redeploy** — that is not done yet and #99 stays open until it is.

**Measured while unblocking** (three runs each, production build): story text **7.9–9.4s**, full flow
including the illustrated cover **15.9–18.2s**. The hero's "about twenty seconds" is therefore
accurate and slightly conservative.

**Issue:** [#97](https://github.com/aio-studios/children-story-app/issues/97)
**Branch:** `feat/97-landing-page` (off `main`)
**Design:** [docs/designs/landing-page-directions.html](../docs/designs/landing-page-directions.html) — **Direction C "The Dual Track"**, with Direction B's hero demo folded in. Approved 2026-09-05.
**Last updated:** 2026-09-05

## TLDR

The app is on Sarthak's resume, so the highest-value visitor is now a hiring manager clicking cold
on a phone with ~5 seconds of patience. Today `/` drops them into a story-setup form that explains
nothing.

Build a real landing page at `/` that pitches the product above the fold, proves it with a live
scripted demo and real screenshots, then — below a clear seam — tells the engineering story for the
reader who is actually assessing whether Sarthak can build. The existing app moves wholesale to
`/create`.

## Critical Decisions

- **Landing at `/`, app at `/create`** — the app is a client-side state machine with no routing of
  its own, so this is a file move, not a refactor. Beats first-visit detection, which costs a
  hydration flash, kills SEO on the one page a recruiter might search, and hides the pitch from
  anyone returning for a second look.
- **Direction C + B's demo** — C is the only direction that admits who is actually reading. B's
  scripted demo goes in C's hero so the page *shows* rather than tells, but keeps a real pitch above
  it as a fallback when the demo can't run.
- **Fredoka + Nunito, not Fraunces** — deliberate deviation from the mock. Reuses the app's own
  display/body faces from `lib/fonts.ts`, so landing and app read as one product and the most
  performance-sensitive page in the app adds no third font download (Speed Insights is live).
- **Existing `--sk-*` tokens** — no new palette. Light/dark parity is a requirement, not a nice-to-have.
- **Static server component, one client island** — the whole landing renders on the server; only the
  hero demo is `"use client"`. Keeps the cold-visit payload near zero.
- **The landing reuses the app's own breakpoints, not new ones** — see *Responsive model* below. A
  large share of recruiters open a resume link on a laptop, so laptop is a first-class shape, not an
  afterthought.
- **Links, not figures, for anything that drifts** — "Behind the build" cites code and docs rather
  than hardcoding numbers that rot. Verified claims only.
- **Name is Storykins** — [#68](https://github.com/aio-studios/children-story-app/issues/68) closed
  2026-09-05.

## Responsive model — laptop, iPad and phone must all land

The app already has a documented three-shape system (`lib/useLayoutMode.ts`,
[docs/designs/v2-redesign-decisions.md](../docs/designs/v2-redesign-decisions.md)). The landing uses
**the same media queries**, so the two never disagree about what shape a device is:

| Shape | Query | App renders | Landing must render |
|---|---|---|---|
| Tablet / laptop | `(min-width: 768px) and (min-height: 600px)` | Left sidebar, roomy multi-column | Genuine wide composition — two-column hero (copy beside demo), multi-column decision cards |
| Landscape phone | `(orientation: landscape) and (max-height: 600px)` | 64px left icon rail | Short-viewport layout; hero must not need a scroll to reach the CTA |
| Portrait phone | baseline | Bottom bar, 428px column | Single column, the baseline design |

**Verified empirically 2026-09-05** by probing the running app at each viewport: laptop 1440×900 and
iPad 834×1194 both resolve to `sk-shell-tablet`; iPhone 390×844 resolves to `sk-shell-portrait`.

**What the app actually looks like on a laptop:** it fills the width — `.sk-shell-tablet .sk-content`
sets `max-width: none`, so a 1440px screen gets the left sidebar plus full-bleed horizontally
scrolling story shelves. It reads as a desktop app, not a stretched phone.

**So the landing goes genuinely wide at ≥768px** — full-bleed section bands and a wide hero, matching
what sits behind the CTA. A cautious narrow column here would look *less* finished than the app it
links to. Issue [#98](https://github.com/aio-studios/children-story-app/issues/98) tracks the
remaining gap (the tablet shape is reused for pointer input rather than designed for it), deliberately
out of scope here.

**Screenshots follow the shape.** A phone screenshot shown on a laptop landing looks mismatched, so
each shape's screenshot row uses captures taken at that shape — the laptop landing shows the app's
sidebar layout, the phone landing shows the bottom-bar layout.

## Verified facts for "Behind the build"

Checked against real code on 2026-09-05 — re-verify before changing any of this copy:

| Claim | Source |
|---|---|
| Two-layer safety: local regex pre-filter + Haiku classifier | `lib/contentSafety.ts` |
| Shared Redis sliding window, 3 story-starts/60s, separate 15/60s for interactive beats | `lib/rateLimit.ts` |
| Text model `claude-haiku-4-5` | `lib/anthropicClient.ts` |
| Image model `gemini-2.5-flash-image`, opt-in per story | `lib/imageClient.ts`, `components/IllustrationToggle.tsx` |
| Repo, changelog and case studies are public and linkable | `gh repo view` → PUBLIC |

## Tasks

- [x] 🟩 **Step 1: Move the app to `/create`** — done 2026-09-05
  - [x] 🟩 `git mv app/page.tsx app/create/page.tsx` — contents untouched, git tracked it as a rename
  - [x] 🟩 Confirmed: repo has zero `href=`, zero `next/link`, zero `useRouter`; `AppShell` navigates by callback
  - [x] 🟩 `npm run build` passes; `/create` → 200, `/` → 404 (expected, no landing yet)
  - [x] 🟩 Shell shape verified by probing the running app: laptop 1440×900 and iPad 834×1194 → `sk-shell-tablet`; iPhone 390×844 → `sk-shell-portrait`

- [x] 🟩 **Step 2: Capture fresh screenshots of the current app, at all three shapes** — done 2026-09-05
  - [x] 🟩 Playwright against a **production** build (not `next dev`) at laptop **1440×900**,
    iPad **834×1194**, iPhone 12 Pro **390×844** (DPR 2–3). Production matters: the dev build paints
    the Next.js dev-tools badge into every capture, which was visible in the first pass.
  - [x] 🟩 Home + all three setup steps captured at each shape, light **and** dark (theme via
    `page.emulateMedia`, so one session yields both)
  - [x] 🟩 Sanity-checked: each capture shows the expected shell for its shape
  - [x] 🟩 Reader captures with a real generated story **and** a real generated cover
  - [x] 🟩 Optimised into `public/landing/` — 18 files, 2.1MB total, nothing reused from 2026-08-10
  - [x] 🟩 Compressed properly (JPEG q70, per-shape widths) rather than repeating [#95](https://github.com/aio-studios/children-story-app/issues/95)

- [x] 🟩 **Step 3: Landing shell + hero** — done
  - [x] 🟩 New `app/page.tsx` — static server component, no `"use client"`
  - [x] 🟩 `components/landing/` for the sections; landing-only styles as `.sk-lp-*` in `globals.css`, matching the existing `.sk-*` convention
  - [x] 🟩 Hero: eyebrow, headline, subhead, primary CTA → `/create`, trust strip
  - [x] 🟩 Sticky mini-header with the Storykins wordmark + "Open app"
  - [x] 🟩 Hero composes to two columns (copy | demo) at the tablet/laptop query, single column in portrait
  - [x] 🟩 Landscape-phone check: CTA reachable without scrolling on a 844×390 viewport

- [x] 🟩 **Step 4: Hero demo (the one client island)** — done
  - [x] 🟩 `components/landing/StoryDemo.tsx` — `"use client"`, scripted: genre → character → lesson → text types out
  - [x] 🟩 Canned copy using real content (Fantasy / Luna the Apprentice Witch / Kindness); no API call from the landing
  - [x] 🟩 `prefers-reduced-motion` renders the finished story statically — no typing, no pulse
  - [x] 🟩 Starts on `IntersectionObserver`, has a Replay control, and cleans up its timers on unmount

- [x] 🟩 **Step 5: Screenshot row + "Behind the build"** — done
  - [x] 🟩 Screenshot row using `next/image` with the Step 2 captures
  - [x] 🟩 Section seam that reads as a deliberate shift, not a bolt-on — this is the direction's main risk
  - [x] 🟩 Stack chips, three decision cards (safety, rate limiting, opt-in illustration), compact metrics row
  - [x] 🟩 Outbound links: GitHub repo, case studies, CHANGELOG — real URLs, all public

- [x] 🟩 **Step 6: SEO + metadata** — done
  - [x] 🟩 Real `title`/`description` in `app/layout.tsx` (currently bare), plus per-route metadata for `/create`
  - [x] 🟩 `openGraph` + `twitter` card
  - [x] 🟩 OG image (Next's `opengraph-image` convention)
  - [x] 🟩 `robots.ts` / `sitemap.ts`

- [x] 🟩 **Step 7: Verification** — all but UAT
  - [x] 🟩 Playwright QA at **all four** viewports — laptop 1440×900, iPad 834×1194, iPhone 12 Pro
    390×844, landscape phone 844×390 — in light **and** dark: no horizontal scroll, no collapsed
    elements, fonts actually loaded, images decoded, demo runs, reduced-motion path renders
  - [x] 🟩 Side-by-side check at each shape: landing screenshot next to the real `/create` screenshot
    at the same viewport, confirming they read as one product (type scale, column width, spacing rhythm)
  - [x] 🟩 `/verify` — drive `/` → CTA → `/create` → generate a real story end to end
  - [x] 🟩 `/code-review` and `/security-review` on the diff
  - [x] 🟩 `/document` — CHANGELOG.md, and `docs/architecture.md` (routing structure genuinely changed)
  - [x] 🟩 Desktop UAT round 1 (2026-09-05): shared wordmark, 1280px capped+centred app, roomier
    landing section rhythm, cover art on sample cards, iPhone/iPad device showcase. One regression
    found and fixed in the same pass (see below).
  - [x] 🟩 Desktop UAT round 2 (2026-09-05): whole landing contained inside the 1280 cap (header
    and bands included), screenshot row reduced to three equal columns, more hero padding,
    interactive-mode showcase section, labelled "Not built yet" roadmap strip.
  - [ ] 🟥 **Mobile UAT — outstanding.** Sarthak is checking phone next.

**Standing QA rule added:** the harness now walks every element inside `.sk-lp` and fails if any
crosses the container edge, asserts the container is centred at ≥1280, and checks the header wordmark
aligns with the hero content to the pixel. It also scrolls the full page before asserting on images,
because `loading="lazy"` shots below the fold never fetch otherwise — that produced a burst of false
"image failed" reports once the page grew.

**Regression caught during desktop UAT:** `margin-inline: auto` on a flex item (`<body>` is
`flex flex-col`) cancels `stretch` and collapses the element to shrink-to-fit. It measured fine on
Home — the story shelves are intrinsically wide — and silently crushed the setup deck to 469px.
Use `width: 100%` + `align-self: center` to centre a flex item under a max-width. **Measure the
narrowest view, not the widest**, when verifying a container cap.

## Findings worth keeping

Things this build turned up that cost real time:

- **Capture against a production build.** `next dev` renders the dev-tools badge; it was baked into
  the first screenshot pass and would have shipped a development artifact onto a page aimed at
  engineers. The capture script now asserts the badge is absent before spending a generation.
- **`min-height: 600px` is load-bearing.** `AppScreenshot` first matched on width alone, so a
  landscape phone (844×390) was served iPad screenshots — exactly the landing/app disagreement the
  component exists to prevent. Mirror `useLayoutMode`'s query in full, not approximately.
- **`metadataBase` must be set.** Without it Next resolves `og:image` against `localhost`, so every
  shared link renders a broken preview card. Set once in `app/layout.tsx` via `lib/siteUrl.ts`.
- **The cover control is `role="switch"`, not `role="button"`.** A `getByRole('button')` lookup
  matches nothing and, guarded by `if (await count())`, fails silently — three story generations were
  captured with no cover before anyone noticed.
- **`npm run build | head` kills the build.** `head` closing the pipe sends SIGPIPE, leaving a
  half-written `.next` that `next start` then serves. Never pipe a build into a truncating command.
- **`pkill -f "next start"` does not match the running server.** It renames itself to `next-server`,
  so an orphan can squat on the port, silently serve a stale build, and make every later `npm start`
  die with `EADDRINUSE`. Check with `lsof -nP -iTCP:<port> -sTCP:LISTEN`.
- **`/_vercel/*` beacons 404 on any local production server.** Expected — they only exist on Vercel's
  edge. The QA script filters them so real 404s stay visible.

## Risks

- **The seam in Step 5 is the whole bet.** Get the transition from product to engineering wrong and
  the page reads as a class project with marketing bolted on.
- **Copy rot.** Every "Behind the build" claim is verified above. Anything likely to drift gets a
  link instead of a number.
- **The route move touches the app's only entry point.** Low risk given zero internal links, but
  it's the one change that can break everything — hence its own step, built and loaded before any
  landing code exists.
- **Screenshots go stale.** They are a snapshot of the app on capture day and will need refreshing
  after any significant visual change.

## Out of scope (deliberately)

- [#96](https://github.com/aio-studios/children-story-app/issues/96) per-application tracking links —
  depends on this page existing first.
- **Supabase keep-alive cron.** ⚠️ `vercel.json` exists **only** on `feat/92-accounts-auth-foundation`,
  and Vercel crons run only on production deployments — so the keep-alive ping currently runs nowhere
  and the Supabase project will keep auto-pausing every 7 days. Not fixed here. Cheap fix when wanted:
  land a dependency-free ping route on `main` (plain `fetch`, no `@supabase/ssr` import, so no auth
  code merges early).

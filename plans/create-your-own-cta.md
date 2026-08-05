# "Create your own" CTA (#65) — Implementation Plan

**Overall Progress:** `100%` — code + art + verify + reviews + docs done. Awaiting final UAT; PR held until #64 merges (rebase onto main, then open clean #65 PR).

## Resume point (2026-08-05 ~14:15)
- All work on branch **`feat/create-your-own-cta`** (branched off `feat/legibility-pass`), pushed. No PR opened yet.
- **UAT round 2 applied** (user feedback): (1) moved the *whole* "Start a new story" section — CTA + "Or pick a genre" + preset strip — to between Daily picks and Most popular (not just the CTA card); (2) icon frame now circular (`border-radius: 9999px`) so the round art isn't cropped in a square; (3) boxed → arrow replaced with a minimal `›` chevron; (4) icon regenerated as an **open storybook with floating stars** (was a magic wand). Re-verified @390px light+dark (CTA top ~388px, no overflow, icon loads, 5 preset chips).
- **Next steps to ship:** (1) user gives final UAT sign-off on the live app; (2) user merges **PR #64** (#60/#62); (3) `git checkout feat/create-your-own-cta && git rebase main` (drops the now-merged #60/#62 commits) → open a clean #65 PR to main; (4) on merge, close #60/#62/#65 and move their board cards to Done.

## TLDR
Promote the custom-genre entry from a bland, buried last chip in the genre strip to a **standalone, always-visible, illuminated CTA band** on Home, directly under "Start a new story". Adds an illustrated icon (via the #59 art pipeline). Genre strip becomes preset-only, relabeled "Or pick a genre". Design approved in [docs/designs/create-your-own-cta-preview.html](../docs/designs/create-your-own-cta-preview.html) (Standalone CTA band option).

## Critical Decisions
- **Standalone CTA band** (user-picked over first-chip / hero-card) — best fixes both "bland" and "buried".
- **Bronze gradient + soft glow pulse + sheen sweep** (reduced-motion safe) so it reads as the primary "make something" action, distinct from genre tiles. CTA-specific `--cta-*` tokens (not the genre accent), themed for legible text in light + dark.
- **Illustrated icon** via existing pipeline (`generate-art.mjs` → `optimize-art.mjs`) → `public/create-your-own.jpg`. Subject: a glowing magic wand with a star tip + sparkles, same storybook style as #59. **Graceful emoji (✨) fallback** if the asset is missing (img-over-emoji, no new state).
- **No prop/logic change** — reuses `onSelectCustomGenre`; only Home layout + CSS + one asset.
- **Branches off #60/#62** (`feat/legibility-pass`) since it builds on the 76px chips + fade; rebase onto main once #64 merges.

## Tasks
- [x] 🟩 **Step 1: Art asset** — add "create-your-own" entry to `scripts/generate-art.mjs` + route it to `public/` root in `scripts/optimize-art.mjs`; run both (paid Gemini call). Emoji fallback means the feature ships even if this fails/retries.
- [x] 🟩 **Step 2: CTA styles** — `.sk-create-cta` (+ `-ico`/`-img`/`-body`/`-title`/`-sub`/`-arrow`) and `.sk-create-cta`-adjacent `--cta-*` tokens + section label in `app/globals.css`; glow/sheen keyframes, reduced-motion guard.
- [x] 🟩 **Step 3: HomeScreen** — remove custom chip from `.sk-genre-strip`; render the CTA button (img + ✨ fallback) under the "Start a new story" head; add "Or pick a genre" label above the preset-only strip.
- [x] 🟩 **Step 4: Verify** — Playwright Home @390px light + dark: CTA visible without scrolling, no overflow, strip still shows 5 presets + peek/fade, fallback works.
- [x] 🟩 **Step 5: Review + docs** — `/code-review`, `/security-review`, `/document`.

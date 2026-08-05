# Setup Flow Art (#59) — Implementation Plan

**Overall Progress:** `95%` — built, verified, reviewed, documented. Awaiting UAT sign-off to close #59.

## TLDR
Replace the emoji placeholders on the setup cards + Home genre strip with real static illustrated art: **15 character portraits** + **5 genre scenes**, AI-generated once via the approved Gemini prompt, optimized, and committed to `/public`. $0 at runtime, style-matched to the #38 covers. Design approved: [docs/designs/setup-flow-art-preview.html](../docs/designs/setup-flow-art-preview.html). 8 of 20 assets (3 characters + all 5 genres) are already generated and approved in [docs/designs/source-art/](../docs/designs/source-art/).

## Critical Decisions
- **AI-generate once → static assets** (locked in exploration) — one-time script, not per-request. $0/user, fully controllable.
- **Plain `<img>`, not `next/image`** — matches the existing codebase pattern (StoryReader uses plain `<img>`); assets are pre-sized static files, so the optimizer adds little. `loading="lazy"` + explicit dimensions.
- **JPEG, not WebP** — `sips` can't emit WebP and neither `cwebp` nor `sharp` is installed; adding a dep for a one-time conversion isn't worth it. All backgrounds are opaque (the round orb clips the circle), so transparency is moot. JPEG @240px q82 ≈ 20KB each.
- **Do NOT regenerate the 8 approved sources** — Nano Banana drifts between runs; the approved genre set especially must stay exact. The generation script skips any source file that already exists.
- **One image per asset, both themes** — only the card frame tracks light/dark (approved). Animation (genre GIF/video) stays deferred to its own future issue.
- **Emoji stays as fallback** — components render the image only when an `image` path is present; `🧑` / `genre.icon` remain for the "Create your own" tiles and any asset that's missing.

## Asset inventory
- **Characters (15):** adventure(finn✅, zara, pip), fantasy(oren, luna, ember✅), animals(baxter, coco✅, nimbus), bedtime(sammy, willow, snug), sci-fi(cosmo, nova, blip). ✅ = already approved. **12 to generate.**
- **Genres (5, all approved):** adventure, fantasy, animals, bedtime, sci-fi.
- **Output paths:** `/public/characters/<id>.jpg`, `/public/genres/<id>.jpg`.

## Tasks:

- [x] 🟩 **Step 1: Finalize generator + produce the 12 missing character portraits**
  - [x] 🟩 Promote `scripts/generate-sample-art.mjs` → `scripts/generate-art.mjs`: enumerate all 15 characters + 5 genres (keyed by real ids), write PNGs to `docs/designs/source-art/`.
  - [x] 🟩 Add a skip-if-exists guard so the 8 approved sources are never regenerated (drift protection).
  - [x] 🟩 Ran it — generated 12 new portraits (first try each), skipped the 8 approved. Full-set contact sheet reviewed, style consistent.

- [x] 🟩 **Step 2: Optimize + place assets in `/public`**
  - [x] 🟩 `scripts/optimize-art.mjs`: each source PNG → JPEG, 240px, q80 → `/public/characters/<id>.jpg` + `/public/genres/<id>.jpg` (maps source `genre-scifi` → `sci-fi`).
  - [x] 🟩 All 20 files present, ~12–24KB each (~350KB total).

- [x] 🟩 **Step 3: Data model**
  - [x] 🟩 Added optional `image?: string` to `PresetCharacter` and `Genre` in `lib/types.ts`.
  - [x] 🟩 Populated `image` for all 15 characters + 5 genres in `lib/genres.ts`.

- [x] 🟩 **Step 4: Render art with emoji fallback**
  - [x] 🟩 `CharacterCard` — `<img>` in the 64px orb when `character.image` set, else `🧑`.
  - [x] 🟩 Setup `GenreCard` — `<img>` in the 80px orb when `genre.image` set, else `genre.icon`; idle/active animation preserved.
  - [x] 🟩 Home `sk-genre-chip` — small round `<img>` (`.sk-genre-chip-img`) when `genre.image` set, else `genre.icon`.
  - [x] 🟩 "Create your own" ✏️ tile and `CustomGenreCard` left unchanged. tsc + lint clean.

- [ ] 🟥 **Step 5: Verify, review, document, UAT**
  - [x] 🟩 `/verify` — Playwright drove Home + Genre + Character steps at iPhone 12 Pro, light + dark: 22/22 assertions pass (5 genre chips, 5 genre orbs, 3 portraits all load + circular; selected state reads; "Create your own" keeps emoji). Screenshots eyeballed.
  - [x] 🟩 `/code-review` + `/security-review` on the diff — no blocking findings (one optional `onError` hardening noted and intentionally skipped for controlled static assets).
  - [x] 🟩 `/document` — CHANGELOG.md (Added) + architecture.md (art field + fallback note).
  - [ ] 🟥 Guided UAT → on sign-off, close #59 and move its card to Done.

## Risks / notes
- **Bundle size:** 20 × ~20KB ≈ 400KB of static assets total; only 3 character + ~6 genre images load per relevant screen (lazy). Negligible.
- **Style drift across the 12 new portraits:** the approved 3 confirm the fixed prompt holds across human/animal/creature, but each new run is independent — Step 1's spot-check is the gate; individual re-runs are cheap.
- **Source art retention:** full-res approved PNGs live in `docs/designs/source-art/` as the durable source of truth (future edits regenerate from there / reference them), separate from the optimized `/public` JPEGs the app ships.

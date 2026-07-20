# Changelog

All notable changes to this project are documented here, grouped by day, each entry timestamped.

## 2026-07-18

### Added

- 17:02 - Project scaffolding: CLAUDE.md/CTO.md/about_me.md context chain, GitHub org (aio-studios) and repo, issue tracking (Epic/Feature/User Story/Bug/Task types, priority/effort labels), and Claude Code skills for the dev workflow (explore, create-plan, code review, peer-review, document, learning-opportunity, create-issue).
- 17:25 - Project Charter (README.md): vision, Day 1/Day 2/Later roadmap, and locked-in tech stack (Next.js, Tailwind, Claude API, Supabase, Vercel).
- 17:51 - docs/PRD.md (full feature list, functional/non-functional requirements) and docs/architecture.md (technical considerations, system design). Flagged an open risk: ads monetization (F17) vs. children's privacy law (COPPA-style) needs a real decision before that phase, not before Day 1/2.
- 18:03 - Expanded Day 1 scope with story length, reading level, tone/mood, and lesson/value selectors (F3-F6). Added a Future Ideas/backlog section to docs/PRD.md capturing Day 2/Later enhancement ideas (branching stories, character memory, voice/illustration choice, printable keepsakes, photo-based avatars, gamification) for later reassessment.
- 18:18 - Clarified target users/UX ownership in docs/PRD.md: setup/selection is always parent-operated; under-3 is fully parent-driven; 3+ has the child as reader (Day 1) and direct chat participant (Day 2, icon-forward/large-touch-target UI). Target age range ~0-10.
- 18:24 - Set "Storykins" as a working title in README.md and persona/CTO.md (not finalized - "Once Upon a Time" and "Wondertales" were ruled out due to existing competing products of the same name). GitHub repo/org names left unchanged until a permanent name is picked.
- 18:30 - Documented future native iOS/Android goal (F23 in docs/PRD.md) and confirmed no tech stack change is needed for it: Next.js API routes + Supabase already work as a plain backend a future Expo (React Native) app can reuse as-is. Noted the one practice worth adopting now (separate business logic from UI components) in docs/architecture.md.
- 18:35 - Filed 25 GitHub issues: Epic 1 (Day 1 MVP) fully decomposed into 5 Features and 13 User Stories (#3-#22), plus Epics 2-7 (#23-#28) filed as single undecomposed issues for Day 2/Later phases.
- 20:46 - docs/PRD.md: new "Design Principles" section - "smart defaults everywhere" (pre-select sensible defaults at every step so a tired parent can move through setup with minimal decisions).
- 20:52 - docs/PRD.md: new "User Personas" section (Tired Parent, Inquisitive Parent, Curious Child) for Day 2 ideation, explicitly left open for more to be added later. Noted Day 1's static per-genre content as a Day 2 candidate for live AI generation.
- 21:34 - GitHub Projects board ("Storykins Roadmap", linked to the repo) with Backlog/Todo/In Progress/In Review/Done columns; all 26 issues triaged onto it (Epic 1 -> Todo, Day 2/Later -> Backlog).
- 21:34 - Filed issue #29 (Day 2: Home screen with horizontal-scroll sections - Continue story/Daily picks/Most popular/New), added to the board backlog.
- 21:34 - plans/genre-character-selection.md: implementation plan for issue #4.
- 21:34 - Next.js (App Router) + TypeScript + Tailwind scaffolded into the repo (app/, components/, lib/) - first application code.
- 21:34 - Genre & Character Selection screen (app/page.tsx), the first screen of the app: 5 preset genres (Adventure, Fantasy, Animals, Bedtime, Sci-fi) each with a placeholder-animated card (idle loop, 5s energetic loop on click) plus a "type your own genre" option; 15 hand-written preset characters (3 per genre - male/female/non-human gender-neutral); custom character form (name/traits/description); smart defaults pre-selected on load; disabled "Continue" placeholder for the not-yet-built next step.

### Fixed

- 21:34 - Code review (8 finder angles, high effort) caught and fixed: genre card's click animation staying stuck active after a different card was selected; typed custom-genre text being permanently lost when switching to a preset genre and back; a dead redundant event-handler call in the custom genre input; a silent no-op if a genre lookup ever failed; removed an unused decorative constant.

### Security

- 21:34 - Security review: no vulnerabilities found (client-side-only scaffolding, no backend/secrets surface yet).

### Fixed

- 21:49 - UAT fixes on #4: dark-mode text contrast bug (card text was inheriting the theme-aware foreground color while card backgrounds stayed hardcoded light, making text unreadable in dark mode - now explicit); added a default emoji icon per genre card; custom genre card is now clickable anywhere, not just the text input.

### Added

- 21:49 - Filed issue #30 (Day 2: multi-step flows as separate pages, not one scrollable page), added to the board backlog.

# Supabase migrations

The source of truth for the database schema. Applied by hand through the Supabase SQL editor
(project `xbmhlczhufgbumukcdvu`) — there is no CLI link, and no service-role key in this repo by
design, so nothing here runs automatically.

**To rebuild the schema from scratch:** paste each file into the SQL editor in numeric order and
run it. Every file is idempotent, so re-running one that is already applied is a no-op rather than
an error.

**Why this exists:** the schema previously lived only inside `plans/accounts-story-library.md`. On
2026-09-04 the Free-tier project came back from an idle pause and, mid-resume, reported `stories`
as missing — at which point recovery would have meant transcribing SQL out of a markdown doc by
hand. The restore completed on its own and nothing was actually lost, but the near miss was reason
enough to keep the schema in real files.

## Free-tier pause behaviour

Projects pause after 7 days with no database activity. Resuming is not instant, and during the
resume the **API gateway answers before Postgres does** — `/auth/v1/settings` returns healthy config
and REST returns a clean `401` for a missing key, while a table query still 404s with `PGRST205`
("Could not find the table in the schema cache"). That combination looks exactly like a dropped
table. It is not. Wait and re-poll before concluding anything is gone.

`app/api/cron/supabase-ping/route.ts` (daily, via `vercel.json`) prevents the pause — but only for a
*deployed* app, so a long-lived local-only branch can still let the project pause.

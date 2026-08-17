# External Services Register

**Last updated:** 2026-08-16 21:29

Every third-party account Storykins depends on: what it does, where its credentials live, what it
costs, what breaks when it fails, and when it needs renewing.

Kept because the failure modes here are mostly *silent* — an expired key or a paused project doesn't
crash the build, it just stops working for users at some later date with no warning.

> **No secrets in this file.** It records *where* each credential lives, never the value. Anything
> marked "secret" below must never be pasted into chat, a commit, or a `NEXT_PUBLIC_*` variable.

## Renewal & expiry calendar

| Due | What | Action |
|---|---|---|
| **2027-08-16** | **Brevo SMTP key expires** | Generate a new key in Brevo → update it in Supabase's SMTP settings. **Nothing warns you.** When it lapses, magic-link emails stop sending: existing sessions keep working, so the app looks healthy while no one new can sign in. |
| Rolling, every 7 days idle | Supabase project auto-pause (Free tier) | Automated — the daily cron in [vercel.json](../vercel.json) pings the DB. Only a concern if that cron is removed or silently fails; it returns a non-200 so failures show in Vercel's cron logs. |

## Accounts

| Service | Used for | Credentials live in | Cost today |
|---|---|---|---|
| **Anthropic (Claude API)** | Story + beat generation (Haiku) | `ANTHROPIC_API_KEY` — `.env.local` + Vercel | Pay per token |
| **Google AI Studio (Gemini 2.5 Flash Image)** | Optional story cover art (#38) | `GOOGLE_GENERATIVE_AI_API_KEY` — `.env.local` + Vercel | ~$0.04/image, opt-in |
| **Vercel** | Hosting, API routes, cron, Web Analytics, Speed Insights | Vercel account (GitHub login) | Free tier |
| **Vercel Blob** | Generated cover image storage | `BLOB_READ_WRITE_TOKEN` — `.env.local` + Vercel | 5GB included; **cuts off access rather than billing overage** |
| **Upstash Redis** (via Vercel Marketplace) | Per-IP rate limiting (#39) | `KV_REST_API_URL` / `KV_REST_API_TOKEN` (+ `KV_URL`, `REDIS_URL`, read-only token) — injected by the integration | Free tier |
| **Supabase** | Postgres + auth (#92). Project `xbmhlczhufgbumukcdvu` | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design. DB password + service-role key: **password manager only, never in the repo** | Free: 500MB DB / 1GB storage / 50k MAU |
| **Brevo** | SMTP for Supabase auth emails | SMTP login + key — **Supabase dashboard only** (Project Settings → Authentication → SMTP). Secret. Username is the `…@smtp-brevo.com` login, *not* the sender address. | Free: 300 emails/day |
| **GitHub** (`aio-studios`) | Repo, issues, [roadmap board](https://github.com/orgs/aio-studios/projects/1) | GitHub account | Free |
| *(self-generated)* | `CRON_SECRET` — authenticates Vercel's cron calls to `/api/cron/supabase-ping` | Vercel env vars (production + preview) only; deliberately **not** in `.env.local` so the route stays open locally | — |

## Dependency chain

What actually breaks what. Read top-down: a failure cascades to everything indented under it.

```
GitHub (aio-studios)
└── Vercel  ── deploys from main; loses CI/CD if the repo link breaks
    ├── Vercel Blob ........... cover images 404 → reader falls back to story-only
    ├── Upstash Redis ......... rate limiting; story gen FAILS OPEN, image gen FAILS CLOSED (#47)
    ├── Anthropic API ......... story generation dies — the one hard dependency with no fallback
    ├── Google AI Studio ...... cover art dies; degrades gracefully to no illustration
    └── Cron (CRON_SECRET) .... keep-alive stops → Supabase pauses after 7 idle days

Supabase (auth + Postgres)
├── Brevo SMTP ............... NEW sign-ins die; existing sessions unaffected (silent failure)
└── RLS policies ............. the only thing protecting user data — the publishable key is public
```

## Deliberate configuration choices

Things that look like mistakes to whoever finds them next, but aren't.

- **Brevo's "Authorised IPs" restriction is switched OFF** (2026-08-16). With it on, Brevo rejected
  every Supabase send with `525 5.7.1 Unauthorized IP address`. Supabase sends from a rotating pool
  of outbound IPs it does not publish, so an allowlist is unenforceable here rather than merely
  inconvenient — authorising the single IP from Brevo's warning email just defers the same failure.
  Accepted risk: a leaked SMTP key could send mail as us from anywhere (a phishing primitive, which
  is why Brevo defaults it on). Bounded by the key living in exactly one place (Supabase's dashboard,
  never the repo) and expiring 2027-08-16. **Revisit if we ever move to a dedicated sending IP.**
- **The Supabase service-role key is not stored anywhere in this project.** Not an oversight —
  nothing in the design needs it, and its absence means no code path can accidentally bypass RLS.
- **`CRON_SECRET` is intentionally absent from `.env.local`.** The keep-alive route only enforces it
  in production, so leaving it unset keeps the endpoint callable locally for testing.

**Notable asymmetries:**

- **Anthropic is the only vendor with no graceful degradation.** Gemini, Blob, and Upstash all have
  defined fallbacks; a Claude outage means no stories, full stop.
- **Brevo fails invisibly.** Nothing in the app surfaces "email isn't sending" — signed-in users
  notice nothing, and only *new* users hit the wall. Worth a manual sign-in test after any SMTP or
  template change.
- **Supabase's publishable key being public is safe only because RLS is on.** If a future table ships
  without RLS enabled, that key becomes an open door to it. Enable RLS in the same migration that
  creates any new table, never as a follow-up.
- **Vercel Blob cuts off rather than bills.** Good for cost safety, bad for uptime — covers stop
  loading rather than generating a surprise invoice. Related: #95 (covers upload uncompressed,
  ~5x storage waste), which brings that ceiling closer than it should be.

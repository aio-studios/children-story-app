# Supabase email templates

Copies of the auth email templates set in the Supabase dashboard (**Authentication → Emails**).
The dashboard is the live copy; these files exist so the templates can be rebuilt if a project is
lost, and copied into a new one (the dev project, #105).

| File | Dashboard template | Subject |
|---|---|---|
| `magic-link.html` | Magic Link | Your sign-in link |
| `confirm-signup.html` | Confirm signup (a first-ever sign-in gets this one, not Magic Link) | Confirm your email address |

**Why they aren't the stock templates:** the stock ones link to `{{ .ConfirmationURL }}`, the PKCE
code flow. That breaks when the email opens in a different browser from the one that asked for it,
which on phones is most of the time. These link straight to our `/auth/callback` with a
`token_hash`, which `app/auth/callback/route.ts` verifies with `verifyOtp`. Its `type` must be one
`lib/authRedirect.ts` allows (`magiclink`, `signup`, `email`).

**Editing a template needs custom SMTP** (Brevo) to be switched on for that project first.
Supabase keeps templates read-only on its built-in sender.

**When you change one:** update it in **both** Supabase projects (live and dev) and here, then
do a real sign-in test. A broken template fails silently: the email still arrives, but the link
doesn't work.

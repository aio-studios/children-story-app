import type { EmailOtpType } from "@supabase/supabase-js";

// Input guards for the magic-link callback. They live here rather than in app/auth/callback/route.ts
// because Next rejects non-route exports from a route file, and these need to be directly testable -
// they are only reachable in the route's *success* path, which needs a real one-time token, so an
// end-to-end HTTP test silently exercises the failure path instead and proves nothing.

// Only the types this app actually issues. Without an allowlist, `type` is attacker-chosen input
// handed straight to verifyOtp - e.g. a `recovery` link replayed against a different flow.
const ALLOWED_OTP_TYPES = new Set<string>(["magiclink", "signup", "email"]);

export function parseOtpType(raw: string | null): EmailOtpType | null {
  return raw !== null && ALLOWED_OTP_TYPES.has(raw) ? (raw as EmailOtpType) : null;
}

// `next` comes from the URL, so it is an open-redirect vector: `?next=https://evil.example` would
// otherwise resolve to an absolute off-site URL and hand a freshly-authenticated user to an attacker.
// Only same-origin absolute paths are allowed:
//   - `//host` and `/\host` are protocol-relative (off-site) to browsers
//   - any backslash is rejected outright rather than reasoned about, since URL parsers disagree on it
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}

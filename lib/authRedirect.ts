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

// Any absolute URL works here; it exists only so a relative path has something to resolve against.
// `.invalid` is reserved by RFC 2606 and can never be a real host.
const SENTINEL_ORIGIN = "https://sentinel.invalid";

// `next` comes from the URL, so it is an open-redirect vector: a value that resolves off-site would
// hand a freshly-authenticated user to an attacker.
//
// This is an allowlist ("does it still resolve to the origin we started from?") rather than a list of
// forbidden prefixes, because prefix checks only block the tricks you thought of. The version this
// replaced tested `//` and `\` and still let `?next=/%09/evil.example` through: URLSearchParams
// decodes %09 to a literal tab, and the WHATWG URL parser strips tab/LF/CR *before* parsing, turning
// `/<tab>/evil.example` into the protocol-relative `//evil.example`. Same for %0A and %0D.
//
// Returns the re-serialised path, so what the caller redirects to is the normalised form that was
// actually validated, not the raw attacker-supplied string.
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  // Backslash is rejected outright rather than reasoned about - URL parsers disagree on it, and no
  // legitimate in-app path contains one.
  if (raw.includes("\\")) return "/";

  let resolved: URL;
  try {
    resolved = new URL(raw, SENTINEL_ORIGIN);
  } catch {
    return "/";
  }
  if (resolved.origin !== SENTINEL_ORIGIN) return "/";
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

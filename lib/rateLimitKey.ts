import { createClient } from "@/lib/supabase/server";

// Who a rate limit counts against (#92, Step 10).
//
// Per IP, every family behind one home router shared a single 3-stories-a-minute budget: two
// parents and a grandparent on different devices, one "too many requests". A signed-in user now gets
// their own budget, keyed on their account; a guest is still keyed on IP, because nothing else tells
// two guests apart.
//
// getClaims(), not getUser(): both live and dev sign JWTs with an asymmetric key (ES256), so this
// verifies the token locally against the cached public key instead of a round trip to the auth
// server on every story and every beat. It doesn't notice a token revoked in the last hour, which is
// fine here: the worst case is a signed-out session keeping its own budget until the token expires.
//
// Anonymous users are keyed on IP like guests. They're off on live today, but if they were ever
// switched on, one person could mint a fresh account - and a fresh budget - per request.
export async function rateLimitKey(request: Request): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (claims?.sub && claims.is_anonymous !== true) return `user:${claims.sub}`;
  } catch {
    // An auth hiccup must not block generation: fall back to the guest rule.
  }
  return `ip:${clientIp(request)}`;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

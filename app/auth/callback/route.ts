import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseOtpType, safeNextPath } from "@/lib/authRedirect";

// Magic-link landing route. Uses the `token_hash` + verifyOtp flow rather than the PKCE `code`
// exchange on purpose: PKCE stores its verifier in the *originating* browser, so a link opened from
// a mail app (which routinely launches the system default browser, not the one that requested the
// link) fails with "invalid request: both auth code and code verifier should be non-empty". Phones
// hit that constantly. token_hash carries everything needed in the URL, so it works cross-device.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = parseOtpType(searchParams.get("type"));
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // The session cookie is set by the server client's setAll during verifyOtp.
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("Magic-link verification failed:", error.message);
  }

  // Home is a state machine rather than a set of routes, so a failure comes back as a query flag for
  // the UI to surface (Step 7) instead of a dedicated /auth/error route. Deliberately vague to the
  // user: distinguishing "expired" from "already used" from "bad token" leaks link state.
  return NextResponse.redirect(new URL("/?auth=failed", request.url));
}

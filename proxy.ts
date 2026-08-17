import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16.3 deprecated the `middleware` file convention in favour of `proxy` (same request-time
// hook, new name + export). Kept deliberately thin: Next's own guidance is that this layer is not a
// session-management or authorization solution. It only refreshes the auth cookie - authorization
// lives in Postgres RLS, and any server code needing a trustworthy identity calls getUser() itself.
//
// Supabase access tokens are short-lived. Server Components can read cookies but never write them,
// so without this pass a refreshed token has nowhere to land and a signed-in user silently falls
// back to guest partway through a session. This runs the refresh where cookies ARE writable.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Written twice on purpose: onto `request` so anything downstream in this same pass sees
          // the new token, then onto a freshly-built response so the browser actually receives the
          // Set-Cookie headers. Rebuilding the response here (rather than reusing the one above) is
          // what carries the mutated request cookies forward.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(), not getSession(): getSession() trusts whatever is in the cookie, which is attacker-
  // controllable. getUser() revalidates against the auth server. For a guest (no auth cookie at all)
  // this returns immediately without a network call, so the guest-first path pays nothing.
  await supabase.auth.getUser();

  // Must return THIS response object. Returning a different NextResponse drops the refreshed
  // cookies and produces random sign-outs that are miserable to debug.
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except static assets, image files, and the cron keep-alive (which authenticates
    // with CRON_SECRET and has no user session to refresh).
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

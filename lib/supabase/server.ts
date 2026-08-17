import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for Server Components and Route Handlers. Same publishable key as the
// browser client - we deliberately never use the service-role key on user-facing paths, so RLS stays
// in force even if a query is buggy.
//
// Must be created per-request, never hoisted to module scope: it closes over that request's cookies,
// and a shared instance would leak one user's session into another's request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can read cookies but not write them. Refreshed tokens are dropped
            // here on purpose - middleware.ts re-runs the refresh on every request and *can* write,
            // so the session still stays alive. Swallowing this is the documented @supabase/ssr
            // pattern, not a shortcut.
          }
        },
      },
    },
  );
}

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Both values are NEXT_PUBLIC_ and ship in the JS bundle by design -
// the publishable/anon key grants no privileges on its own. Row Level Security (see the `stories`
// migration) is the only thing keeping one family's stories away from another's, which is why RLS
// is a hard requirement rather than a nice-to-have on every table we add.
//
// A new client per call is the documented pattern: @supabase/ssr internally memoises the underlying
// connection, so this is cheap and avoids a module-level singleton capturing a stale session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

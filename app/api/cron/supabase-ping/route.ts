import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's Free tier pauses a project after 7 days with no database activity, and an unpausing
// project is a hard outage for the Library (#92), not a slow first request. This endpoint runs one
// trivial query so the project never goes idle. Scheduled daily rather than weekly in vercel.json:
// a weekly job leaves no margin at all against a 7-day timer, and the invocation cost is nil.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel attaches `Authorization: Bearer $CRON_SECRET` to cron invocations when that env var is
  // set. Without this check the route is a public, unauthenticated database hit.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: a missing secret in production means the route is unprotected, which is worse
    // than the project pausing.
    console.error("CRON_SECRET is not set - refusing to run the Supabase keep-alive ping.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  // Deliberately NOT `{ head: true }`. A HEAD request against a missing table returns a 404 with an
  // empty body, and postgrest-js has a workaround (issues/295) that turns exactly that case into a
  // 204 success with error === null - so a head-only probe reports ok:true even when `stories` does
  // not exist. A real GET returns a JSON error body, which does get surfaced. `limit(0)` keeps the
  // response empty; RLS means an anonymous caller sees no rows regardless.
  const { error } = await supabase.from("stories").select("id").limit(0);

  if (error) {
    // Non-200 so a silently failing keep-alive shows up in Vercel's cron logs instead of letting the
    // project drift into a pause unnoticed.
    console.error("Supabase keep-alive ping failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

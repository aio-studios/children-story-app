import { NextResponse } from "next/server";
import { canonicalCoverUrl, deleteIllustration } from "@/lib/imageClient";
import { createClient } from "@/lib/supabase/server";

// Deletes the signed-in user's account and everything in it (#92, Step 9).
//
// Order matters, and it is the same rule as every other cover delete (lib/coverBlob.ts): references
// first, Blobs second. So: delete the story rows (getting their cover URLs back), delete the
// now-unreferenced covers, then delete the account. A failure part-way leaves either an orphaned Blob
// (logged, and reported to the parent) or an empty account they can delete again - never a story
// pointing at a missing picture.
//
// Runs server-side rather than as a client sequence so one request either gets to the account
// deletion or reports exactly how far it got, and the covers are deleted directly instead of through
// /api/delete-illustration's per-IP rate limit, which a 20-story library could trip.
export async function POST(request: Request) {
  // The client already makes the parent type DELETE. Requiring it here too means no other caller of
  // this route - a stray fetch, a future button - can delete an account without the same intent.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if ((body as Record<string, unknown> | null)?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  // getUser(), not getSession(): it revalidates against the auth server instead of trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
  }

  // Delete the rows and get their covers back from the same statement. A separate read first would
  // miss a story saved on another device in between: its row would go, its cover would stay. RLS
  // scopes this to the caller's own rows; the user_id filter just says so out loud.
  const { data: rows, error: storiesError } = await supabase
    .from("stories")
    .delete()
    .eq("user_id", user.id)
    .select("image_url");
  if (storiesError) {
    console.error("delete-account: deleting stories failed —", storiesError.message);
    return NextResponse.json({ error: "We couldn't delete your account. Nothing was changed." }, { status: 500 });
  }

  const coverUrls = [
    ...new Set((rows ?? []).map(({ image_url }) => canonicalCoverUrl(image_url ?? "")).filter((u): u is string => !!u)),
  ];
  const leftBehind: string[] = [];
  for (const coverUrl of coverUrls) {
    if (!(await deleteCoverWithRetry(supabase, coverUrl))) leftBehind.push(coverUrl);
  }
  // The rows are already gone, so a retry from the client could never find these again. Logged for
  // cleanup by hand (runbook: docs/external-services.md) and reported honestly to the parent below,
  // rather than holding the account hostage to a Blob outage.
  if (leftBehind.length > 0) {
    console.error(`delete-account: ${leftBehind.length} cover(s) left behind after retries —`, leftBehind);
  }

  const { error: accountError } = await supabase.rpc("delete_my_account");
  if (accountError) {
    console.error("delete-account: deleting the account failed —", accountError.message);
    return NextResponse.json(
      { error: "Your stories were deleted, but your account wasn't. Please try again." },
      { status: 500 },
    );
  }

  // Clears the session cookies. The user is already gone, so the server half of this fails, but
  // auth-js removes the local session whatever the server answers.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true, coversLeftBehind: leftBehind.length });
}

// Same canonicalise-then-check as /api/delete-illustration, so a cover some other row still points at
// is left alone (that counts as done, not failed). Three tries with a short backoff, which covers a
// transient Blob or network blip; anything longer is reported rather than waited out.
async function deleteCoverWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coverUrl: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    const { data: referenced, error } = await supabase.rpc("cover_is_referenced", { cover_url: coverUrl });
    if (error) continue;
    if (referenced) return true;
    if (await deleteIllustration(coverUrl)) return true;
  }
  return false;
}

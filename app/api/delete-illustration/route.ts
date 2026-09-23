import { NextResponse } from "next/server";
import { canonicalCoverUrl, deleteIllustration } from "@/lib/imageClient";
import { checkDeleteRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

// Cleanup of a cover the client has orphaned (regenerated, replaced, or cleared the continue slot)
// so Blob storage doesn't grow unbounded (#46).
//
// Since #92 covers can belong to a saved story, so this is no longer allowed to delete whatever URL
// it is handed. It refuses any Blob a `stories` row still points at (migration 003) — the invariant
// is "unreferenced", not "yours": a cover must outlive every row that references it, whoever owns
// them. That is also the right answer for a guest, whose covers are referenced by no row at all.
export async function POST(request: Request) {
  // Unauthenticated by necessity - guests orphan covers too, and they have no session. Rate-limited
  // per IP so the external Blob call can't be spammed, but on its OWN generous budget: sharing the
  // 3/60s generation budget meant routine cleanup (a few regenerates, an eviction) got refused, and
  // a refused cleanup is a permanent leak because the row referencing it is already gone.
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await checkDeleteRateLimit(`del:${clientIp}`))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const url = (body as Record<string, unknown> | null)?.url;
  if (typeof url !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Canonicalised ONCE, then used for both the check and the delete - see canonicalCoverUrl. Handing
  // the raw string to each would let the two disagree about which blob is being talked about, and the
  // disagreement always resolves in favour of deleting.
  const coverUrl = canonicalCoverUrl(url);
  if (!coverUrl) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: referenced, error } = await supabase.rpc("cover_is_referenced", { cover_url: coverUrl });

  // Fail CLOSED, unlike the rate limiter above. A delete we can't verify is a delete we don't do:
  // the cost of refusing is an orphaned Blob, and the cost of proceeding is someone's saved story
  // losing its cover for good.
  if (error) {
    console.error("delete-illustration: reference check failed —", error.message);
    return NextResponse.json({ error: "Couldn't verify that cover. Nothing was deleted." }, { status: 503 });
  }
  if (referenced) {
    return NextResponse.json({ error: "That cover still belongs to a saved story." }, { status: 409 });
  }

  await deleteIllustration(coverUrl);
  return NextResponse.json({ ok: true });
}

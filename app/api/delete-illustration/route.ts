import { NextResponse } from "next/server";
import { deleteIllustration } from "@/lib/imageClient";
import { checkRateLimit } from "@/lib/rateLimit";

// Fire-and-forget cleanup of a cover the client has orphaned (regenerated, replaced, or cleared the
// continue slot) so Blob storage doesn't grow unbounded (#46). deleteIllustration is prefix-guarded
// to our own story-covers path and swallows its own errors, so this always resolves ok.
export async function POST(request: Request) {
  // Unauthenticated endpoint that makes an external Blob call per request - rate-limit per IP so it
  // can't be spammed. Fails open: cleanup isn't costly, so a Redis blip shouldn't block it.
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await checkRateLimit(`del:${clientIp}`))) {
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

  await deleteIllustration(url);
  return NextResponse.json({ ok: true });
}

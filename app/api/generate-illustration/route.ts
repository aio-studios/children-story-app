import { NextResponse } from "next/server";
import { classifySafety, containsBlockedContent } from "@/lib/contentSafety";
import { buildImagePrompt } from "@/lib/imagePrompt";
import type { StorySelections } from "@/lib/storyPrompt";
import { CoverRefusedError, generateIllustration } from "@/lib/imageClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { collectCustomText, validateSelections } from "@/lib/validateSelections";

const GENERIC_ERROR_MESSAGE = "The cover didn't come through this time.";
const REFUSED_ERROR_MESSAGE = "We can't draw this character.";
const RATE_LIMIT_ERROR_MESSAGE = "Just a moment before making another picture.";
const MAX_TITLE_LENGTH = 200;

function isValidTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TITLE_LENGTH;
}

export async function POST(request: Request) {
  // Own rate-limit bucket, separate from story generation, since images cost more per call.
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  // failClosed: unlike story generation, a Redis outage here must not leave paid image gen uncapped (#47).
  const allowed = await checkRateLimit(`illust:${clientIp}`, true);
  if (!allowed) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR_MESSAGE }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = body as Record<string, unknown> | null;
  const selections = b ? validateSelections(b.selections) : null;
  if (!selections || !b || !isValidTitle(b.title)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Re-run safety gates (this is a separate entry point that can't trust the client already passed
  // them). Unlike story generation, the title ALSO feeds the prompt here and is client-supplied, so
  // it's safety-checked too - a direct caller could pair safe preset selections with a malicious
  // title. Gemini's own filter is a backstop, not our only guard.
  const customText = collectCustomText(selections);
  const safetyText = [customText, `Story title: ${b.title}`].filter(Boolean).join("\n");
  if (containsBlockedContent(safetyText)) {
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 400 });
  }
  try {
    const inputCheck = await classifySafety(safetyText);
    if (!inputCheck.safe) {
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 400 });
    }
  } catch (error) {
    console.error("Illustration input safety check failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }

  try {
    return NextResponse.json({ imageUrl: await renderCover(selections, b.title) });
  } catch (error) {
    // A refusal that survived the nameless retry. 422, not 502: nothing is broken and retrying the
    // same request will refuse again, so the client says so rather than inviting another attempt.
    if (error instanceof CoverRefusedError) {
      return NextResponse.json({ error: REFUSED_ERROR_MESSAGE, reason: "refused" }, { status: 422 });
    }
    console.error("Illustration generation failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}

// Two attempts at most, and only ever two. The second drops the character's name and the title,
// which is what Gemini declines when it declines at all (#103) - a cover needs the description, not
// the name. A transport failure is not retried here: it isn't a CoverRefusedError, so it propagates
// on the first throw rather than spending a second paid image call on the same broken condition.
async function renderCover(selections: StorySelections, title: string): Promise<string> {
  try {
    return await generateIllustration(buildImagePrompt(selections, title));
  } catch (error) {
    if (!(error instanceof CoverRefusedError)) throw error;
    return await generateIllustration(buildImagePrompt(selections, title, { nameless: true }));
  }
}

import { NextResponse } from "next/server";
import { anthropicClient, extractJsonBlock, HAIKU_MODEL } from "@/lib/anthropicClient";
import { classifySafety, containsBlockedContent } from "@/lib/contentSafety";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildStoryPrompt } from "@/lib/storyPrompt";
import { collectCustomText, validateSelections } from "@/lib/validateSelections";

const GENERIC_ERROR_MESSAGE = "Oops! Our storyteller is having a little trouble right now. Please try again.";
const RATE_LIMIT_ERROR_MESSAGE = "Whoa, one story at a time! Please wait a moment before trying again.";
// Separate messages: the input-side blocks (rules filter, input classifier) only ever fire when
// there's a custom entry to point at; the output-side block can fire on a preset-only request too,
// where "adjust your custom entry" would be nonsensical.
const CUSTOM_ENTRY_BLOCK_MESSAGE = "Hmm, let's try a different idea! Please adjust your custom entry and try again.";
const STORY_BLOCK_MESSAGE = "Hmm, that story didn't turn out right. Please try again or pick different options.";

function blockUnsafe(reason: string, message: string) {
  console.warn(`Story generation blocked: ${reason}`);
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const allowed = await checkRateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR_MESSAGE }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const selections = validateSelections(body);
  if (!selections) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const customText = collectCustomText(selections);

  if (customText && containsBlockedContent(customText)) {
    return blockUnsafe("rules-based filter", CUSTOM_ENTRY_BLOCK_MESSAGE);
  }

  if (customText) {
    try {
      const inputCheck = await classifySafety(customText);
      if (!inputCheck.safe) {
        return blockUnsafe("input classifier", CUSTOM_ENTRY_BLOCK_MESSAGE);
      }
    } catch (error) {
      console.error("Input safety check failed:", error);
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }
  }

  const { system, user } = buildStoryPrompt(selections);

  let parsed: { title: string; story: string };
  try {
    const response = await anthropicClient.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              story: { type: "string" },
            },
            required: ["title", "story"],
            additionalProperties: false,
          },
        },
      },
    });

    parsed = extractJsonBlock<{ title: string; story: string }>(response);
  } catch (error) {
    console.error("Story generation failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }

  try {
    const outputCheck = await classifySafety(`${parsed.title}\n${parsed.story}`);
    if (!outputCheck.safe) {
      return blockUnsafe("output classifier", STORY_BLOCK_MESSAGE);
    }
  } catch (error) {
    console.error("Output safety check failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }

  return NextResponse.json({ title: parsed.title, story: parsed.story });
}

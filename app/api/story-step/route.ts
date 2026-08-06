import { NextResponse } from "next/server";
import { anthropicClient, extractJsonBlock, HAIKU_MODEL } from "@/lib/anthropicClient";
import { classifySafety, containsBlockedContent } from "@/lib/contentSafety";
import { InteractiveStory, LENGTH_BEAT_RANGE, StepAction } from "@/lib/interactive";
import { checkStepRateLimit } from "@/lib/rateLimit";
import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { buildStepPrompt } from "@/lib/stepPrompt";
import { validateSelections } from "@/lib/validateSelections";

const GENERIC_ERROR_MESSAGE = "Oops! Our storyteller is having a little trouble right now. Please try again.";
const RATE_LIMIT_ERROR_MESSAGE = "Whoa, slow down a moment! Give the story a few seconds to catch up.";
const INPUT_BLOCK_MESSAGE = "Hmm, let's try a different idea! Please pick another direction or reword your own.";
const BEAT_BLOCK_MESSAGE = "Hmm, that part didn't turn out right. Try continuing again or pick a different direction.";

// Guards against an oversized client payload (the whole story is re-sent each beat). Comfortably
// above the largest arc (12 beats) so a real story is never rejected.
const MAX_BEATS = 24;
const MAX_BEAT_LENGTH = 6000;

function blockUnsafe(reason: string, message: string) {
  console.warn(`Story step blocked: ${reason}`);
  return NextResponse.json({ error: message }, { status: 400 });
}

function isStringArray(value: unknown, maxItems: number, maxLen: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxLen)
  );
}

function validateAction(value: unknown): StepAction | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind === "continue") return { kind: "continue" };
  if ((v.kind === "choice" || v.kind === "freeText") && typeof v.text === "string") {
    const text = v.text.trim();
    if (text.length === 0 || text.length > MAX_CUSTOM_TEXT_LENGTH) return null;
    return { kind: v.kind, text };
  }
  return null;
}

// Rebuilds a trusted InteractiveStory from the request. The arc range is derived server-side from
// the chosen length (never trusted from the client), and `current` is pinned to the actual beat
// count - so a tampered payload can't lift the hard cap that stops the story rambling forever.
function validateStory(value: unknown): InteractiveStory | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const selections = validateSelections(v.selections);
  if (!selections) return null;
  if (typeof v.title !== "string" || v.title.length > 200) return null;
  if (!isStringArray(v.beats, MAX_BEATS, MAX_BEAT_LENGTH)) return null;

  const range = LENGTH_BEAT_RANGE[selections.length];
  return {
    title: v.title,
    selections,
    arc: { min: range.min, max: range.max, current: (v.beats as string[]).length },
    beats: v.beats as string[],
    choices: [],
    // Not used to build the next beat (buildStepPrompt only needs beats/arc/selections); the client
    // owns the choice history for "Go back".
    beatChoices: [],
    ended: false,
  };
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const allowed = await checkStepRateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR_MESSAGE }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const story = validateStory(b?.story);
  const action = validateAction(b?.action);
  if (!story || !action) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Any user-authored direction (a picked choice or free text) is untrusted input into the prompt -
  // run it through the same rules filter + classifier the one-shot flow uses on custom entries.
  if (action.kind === "choice" || action.kind === "freeText") {
    if (containsBlockedContent(action.text)) {
      return blockUnsafe("rules-based filter", INPUT_BLOCK_MESSAGE);
    }
    try {
      const inputCheck = await classifySafety(action.text);
      if (!inputCheck.safe) {
        return blockUnsafe("input classifier", INPUT_BLOCK_MESSAGE);
      }
    } catch (error) {
      console.error("Step input safety check failed:", error);
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }
  }

  const { system, user, mustEnd } = buildStepPrompt(story, action);

  let parsed: { title: string; beatText: string; choices: string[]; isEnding: boolean };
  try {
    const response = await anthropicClient.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              beatText: { type: "string" },
              choices: { type: "array", items: { type: "string" } },
              isEnding: { type: "boolean" },
            },
            required: ["title", "beatText", "choices", "isEnding"],
            additionalProperties: false,
          },
        },
      },
    });
    parsed = extractJsonBlock<typeof parsed>(response);
  } catch (error) {
    console.error("Story step generation failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }

  try {
    const outputCheck = await classifySafety(parsed.beatText);
    if (!outputCheck.safe) {
      return blockUnsafe("output classifier", BEAT_BLOCK_MESSAGE);
    }
  } catch (error) {
    console.error("Step output safety check failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }

  // Enforce the arc range regardless of what the model returned: hard-cap forces an ending at max,
  // and the floor prevents ending before the minimum beat count. Ending clears the choices.
  const nextBeat = story.arc.current + 1;
  const isEnding = mustEnd || (parsed.isEnding && nextBeat >= story.arc.min);
  const choices = isEnding ? [] : parsed.choices.filter((c) => c.trim().length > 0).slice(0, 3);

  // The title is only meaningful on the opening beat; the client keeps its first one thereafter.
  const title = story.beats.length === 0 ? parsed.title : story.title;

  return NextResponse.json({ title, beatText: parsed.beatText, choices, isEnding });
}

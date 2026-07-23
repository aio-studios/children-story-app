import { NextResponse } from "next/server";
import { anthropicClient, extractJsonBlock, HAIKU_MODEL } from "@/lib/anthropicClient";
import { classifySafety, containsBlockedContent } from "@/lib/contentSafety";
import { GENRES } from "@/lib/genres";
import { buildStoryPrompt, StorySelections } from "@/lib/storyPrompt";
import { LESSONS, MAX_CUSTOM_TEXT_LENGTH, READING_LEVELS, STORY_LENGTHS, TONES } from "@/lib/storyOptions";
import { GenreSelection, Lesson, LessonSelection, SelectedCharacter } from "@/lib/types";

const STORY_LENGTHS_VALUES: string[] = STORY_LENGTHS.map((l) => l.id);
const READING_LEVEL_VALUES: string[] = READING_LEVELS.map((r) => r.id);
const TONE_VALUES: string[] = TONES.map((t) => t.id);

const GENERIC_ERROR_MESSAGE = "Oops! Our storyteller is having a little trouble right now. Please try again.";
const RATE_LIMIT_ERROR_MESSAGE = "Whoa, one story at a time! Please wait a moment before trying again.";
// Separate messages: the input-side blocks (rules filter, input classifier) only ever fire when
// there's a custom entry to point at; the output-side block can fire on a preset-only request too,
// where "adjust your custom entry" would be nonsensical.
const CUSTOM_ENTRY_BLOCK_MESSAGE = "Hmm, let's try a different idea! Please adjust your custom entry and try again.";
const STORY_BLOCK_MESSAGE = "Hmm, that story didn't turn out right. Please try again or pick different options.";

// Basic per-IP stopgap, not the final rate-limiting infra (that's a separate pass before public launch).
// In-memory only - resets on redeploy/restart, doesn't share state across serverless instances - but it's
// enough to stop a naive script from running up the Anthropic bill the moment this route is reachable.
// Each request can trigger up to 3 Claude calls (input safety check, generation, output safety check),
// so this is sized lower than a naive "1 request = 1 Claude call" budget would suggest.
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestTimestamps = new Map<string, number[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const recent = (requestTimestamps.get(identifier) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestTimestamps.set(identifier, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function isNonEmptyString(value: unknown, maxLength = MAX_CUSTOM_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validateGenre(value: unknown): GenreSelection | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.type === "preset" && typeof v.genreId === "string" && GENRES.some((g) => g.id === v.genreId)) {
    return { type: "preset", genreId: v.genreId };
  }
  if (v.type === "custom" && isNonEmptyString(v.text)) {
    return { type: "custom", text: v.text };
  }
  return null;
}

function validateCharacter(value: unknown, genre: GenreSelection): SelectedCharacter | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.type === "preset" && genre.type === "preset" && typeof v.characterId === "string") {
    const genrePreset = GENRES.find((g) => g.id === genre.genreId);
    if (genrePreset?.characters.some((c) => c.id === v.characterId)) {
      return { type: "preset", characterId: v.characterId };
    }
    return null;
  }
  if (v.type === "custom" && isNonEmptyString(v.name) && isNonEmptyString(v.traits) && isNonEmptyString(v.description)) {
    return { type: "custom", name: v.name.trim(), traits: v.traits.trim(), description: v.description.trim() };
  }
  return null;
}

function validateLesson(value: unknown): LessonSelection | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.type === "preset" && typeof v.lessonId === "string" && LESSONS.some((l) => l.id === v.lessonId)) {
    return { type: "preset", lessonId: v.lessonId as Lesson };
  }
  if (v.type === "custom" && isNonEmptyString(v.text)) {
    return { type: "custom", text: v.text };
  }
  return null;
}

function validateSelections(body: unknown): StorySelections | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const genre = validateGenre(b.genre);
  if (!genre) return null;

  const character = validateCharacter(b.character, genre);
  if (!character) return null;

  if (typeof b.length !== "string" || !STORY_LENGTHS_VALUES.includes(b.length)) return null;
  if (typeof b.readingLevel !== "string" || !READING_LEVEL_VALUES.includes(b.readingLevel)) return null;
  if (typeof b.tone !== "string" || !TONE_VALUES.includes(b.tone)) return null;

  const lesson = validateLesson(b.lesson);
  if (!lesson) return null;

  return {
    genre,
    character,
    length: b.length as StorySelections["length"],
    readingLevel: b.readingLevel as StorySelections["readingLevel"],
    tone: b.tone as StorySelections["tone"],
    lesson,
  };
}

// Any new custom-text field added to StorySelections must be added here too, or its text will
// silently skip both the rules filter and the safety classifier below.
function collectCustomText(selections: StorySelections): string | null {
  const lines: string[] = [];

  if (selections.genre.type === "custom") lines.push(`Genre: ${selections.genre.text}`);
  if (selections.character.type === "custom") {
    lines.push(`Character name: ${selections.character.name}`);
    lines.push(`Character traits: ${selections.character.traits}`);
    lines.push(`Character description: ${selections.character.description}`);
  }
  if (selections.lesson.type === "custom") lines.push(`Lesson: ${selections.lesson.text}`);

  return lines.length > 0 ? lines.join("\n") : null;
}

function blockUnsafe(reason: string, message: string) {
  console.warn(`Story generation blocked: ${reason}`);
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(clientIp)) {
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

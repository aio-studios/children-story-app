import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { GENRES } from "@/lib/genres";
import { buildStoryPrompt, StorySelections } from "@/lib/storyPrompt";
import { LESSONS, MAX_CUSTOM_TEXT_LENGTH, READING_LEVELS, STORY_LENGTHS, TONES } from "@/lib/storyOptions";
import { GenreSelection, Lesson, LessonSelection, SelectedCharacter } from "@/lib/types";

const STORY_LENGTHS_VALUES: string[] = STORY_LENGTHS.map((l) => l.id);
const READING_LEVEL_VALUES: string[] = READING_LEVELS.map((r) => r.id);
const TONE_VALUES: string[] = TONES.map((t) => t.id);

const GENERIC_ERROR_MESSAGE = "Oops! Our storyteller is having a little trouble right now. Please try again.";
const RATE_LIMIT_ERROR_MESSAGE = "Whoa, one story at a time! Please wait a moment before trying again.";

// Basic per-IP stopgap, not the final rate-limiting infra (that's a separate pass before public launch).
// In-memory only - resets on redeploy/restart, doesn't share state across serverless instances - but it's
// enough to stop a naive script from running up the Anthropic bill the moment this route is reachable.
const RATE_LIMIT_MAX_REQUESTS = 5;
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

const client = new Anthropic();

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

  const { system, user } = buildStoryPrompt(selections);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
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

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    const parsed = JSON.parse(textBlock.text) as { title: string; story: string };
    return NextResponse.json({ title: parsed.title, story: parsed.story });
  } catch (error) {
    console.error("Story generation failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}

import { GENRES } from "@/lib/genres";
import { StorySelections } from "@/lib/storyPrompt";
import { LESSONS, MAX_CUSTOM_TEXT_LENGTH, READING_LEVELS, STORY_LENGTHS, TONES } from "@/lib/storyOptions";
import { GenreSelection, Lesson, LessonSelection, SelectedCharacter } from "@/lib/types";

const STORY_LENGTHS_VALUES: string[] = STORY_LENGTHS.map((l) => l.id);
const READING_LEVEL_VALUES: string[] = READING_LEVELS.map((r) => r.id);
const TONE_VALUES: string[] = TONES.map((t) => t.id);

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

export function validateSelections(body: unknown): StorySelections | null {
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
// silently skip both the rules filter and the safety classifier that callers run on the result.
export function collectCustomText(selections: StorySelections): string | null {
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

import { GENRES } from "./genres";
import { LESSONS, READING_LEVELS, TONES } from "./storyOptions";
import { GenreSelection, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, Tone } from "./types";

const WORD_COUNT_TARGETS: Record<StoryLength, string> = {
  quick: "about 200-300 words",
  longer: "about 800-1200 words",
};

const READING_LEVEL_GUIDANCE: Record<ReadingLevel, string> = {
  toddler: "Very simple vocabulary, short sentences, lots of repetition, one idea per sentence.",
  "early-reader": "Simple vocabulary, short paragraphs, mostly short sentences.",
  "independent-reader": "Richer vocabulary, longer sentences, more descriptive language.",
};

const TONE_GUIDANCE: Record<Tone, string> = {
  funny: "Playful and funny, with light humor a young child would enjoy.",
  calming: "Calm and soothing, gentle pacing, good for winding down at bedtime.",
  exciting: "Energetic and exciting, with a sense of adventure.",
  heartwarming: "Warm and heartfelt, focused on connection and kindness.",
};

function describeGenre(genre: GenreSelection): string {
  if (genre.type === "custom") return genre.text.trim();
  const preset = GENRES.find((g) => g.id === genre.genreId);
  return preset ? `${preset.label} - ${preset.blurb}` : genre.genreId;
}

function describeCharacter(character: SelectedCharacter, genre: GenreSelection): string {
  if (character.type === "custom") {
    return `${character.name} (${character.traits}) - ${character.description}`;
  }
  const genrePreset = genre.type === "preset" ? GENRES.find((g) => g.id === genre.genreId) : undefined;
  const characterPreset = genrePreset?.characters.find((c) => c.id === character.characterId);
  return characterPreset ? `${characterPreset.name} - ${characterPreset.description}` : character.characterId;
}

function describeLesson(lesson: LessonSelection): string {
  if (lesson.type === "custom") return lesson.text.trim();
  const preset = LESSONS.find((l) => l.id === lesson.lessonId);
  return preset?.label ?? lesson.lessonId;
}

export type StorySelections = {
  genre: GenreSelection;
  character: SelectedCharacter;
  length: StoryLength;
  readingLevel: ReadingLevel;
  tone: Tone;
  lesson: LessonSelection;
};

export function buildStoryPrompt(selections: StorySelections): { system: string; user: string } {
  const readingLevelLabel = READING_LEVELS.find((r) => r.id === selections.readingLevel)?.label ?? selections.readingLevel;
  const toneLabel = TONES.find((t) => t.id === selections.tone)?.label ?? selections.tone;

  const system = [
    "You are a children's story writer for a mobile app called Storykins.",
    "Write a complete, original, wholesome story appropriate for young children.",
    "Never include violence, scary content, romance, or anything inappropriate for a young child.",
    "Respond only with the story itself - no meta-commentary, no notes to the parent.",
  ].join(" ");

  const user = [
    `Genre: ${describeGenre(selections.genre)}`,
    `Main character: ${describeCharacter(selections.character, selections.genre)}`,
    `Length: ${WORD_COUNT_TARGETS[selections.length]}`,
    `Reading level (${readingLevelLabel}): ${READING_LEVEL_GUIDANCE[selections.readingLevel]}`,
    `Tone (${toneLabel}): ${TONE_GUIDANCE[selections.tone]}`,
    `The story should carry a gentle lesson about: ${describeLesson(selections.lesson)}`,
    "",
    "Write the story now, along with a short, kid-friendly title.",
  ].join("\n");

  return { system, user };
}

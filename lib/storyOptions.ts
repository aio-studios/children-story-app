import { Lesson, PillOption, ReadingLevel, StoryLength, Tone } from "./types";

export const STORY_LENGTHS: PillOption<StoryLength>[] = [
  { id: "quick", label: "Quick (~2 min)" },
  { id: "longer", label: "Longer (~10 min)" },
];

export const DEFAULT_STORY_LENGTH: StoryLength = "quick";

export const READING_LEVELS: PillOption<ReadingLevel>[] = [
  { id: "toddler", label: "Toddler" },
  { id: "early-reader", label: "Early reader" },
  { id: "independent-reader", label: "Independent reader" },
];

export const DEFAULT_READING_LEVEL: ReadingLevel = "early-reader";

export const TONES: PillOption<Tone>[] = [
  { id: "funny", label: "Funny" },
  { id: "calming", label: "Calming / bedtime" },
  { id: "exciting", label: "Exciting" },
  { id: "heartwarming", label: "Heartwarming" },
];

export const DEFAULT_TONE: Tone = "heartwarming";

export const LESSONS: PillOption<Lesson>[] = [
  { id: "kindness", label: "Kindness" },
  { id: "courage", label: "Courage" },
  { id: "sharing", label: "Sharing" },
  { id: "honesty", label: "Honesty" },
  { id: "perseverance", label: "Perseverance" },
];

export const DEFAULT_LESSON: Lesson = "kindness";

// Shared between custom-text inputs (client-side maxLength) and the generate-story API route
// (server-side validation), so the two never drift.
export const MAX_CUSTOM_TEXT_LENGTH = 300;

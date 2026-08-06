export type PresetCharacter = {
  id: string;
  name: string;
  description: string;
  // Optional static portrait under /public (#59); components fall back to an emoji when absent.
  image?: string;
};

export type GenreAccent = {
  light: string;
  dark: string;
};

export type Genre = {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  accent: GenreAccent;
  // Optional static scene under /public (#59); components fall back to `icon` when absent.
  image?: string;
  characters: [PresetCharacter, PresetCharacter, PresetCharacter];
};

export type CustomCharacter = {
  type: "custom";
  name: string;
  traits: string;
  description: string;
};

export type SelectedCharacter = { type: "preset"; characterId: string } | CustomCharacter;

export type GenreSelection = { type: "preset"; genreId: string } | { type: "custom"; text: string };

export type StoryLength = "quick" | "longer";

// Classic = today's one-shot full story; interactive = beat-by-beat branching mode (#37).
export type StoryMode = "classic" | "interactive";

export type ReadingLevel = "toddler" | "early-reader" | "independent-reader";

export type Tone = "funny" | "calming" | "exciting" | "heartwarming";

export type Lesson = "kindness" | "courage" | "sharing" | "honesty" | "perseverance";

export type LessonSelection = { type: "preset"; lessonId: Lesson } | { type: "custom"; text: string };

export type PillOption<T extends string> = {
  id: T;
  label: string;
};

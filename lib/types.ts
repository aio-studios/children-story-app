export type PresetCharacter = {
  id: string;
  name: string;
  description: string;
};

export type Genre = {
  id: string;
  label: string;
  icon: string;
  blurb: string;
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

export type ReadingLevel = "toddler" | "early-reader" | "independent-reader";

export type Tone = "funny" | "calming" | "exciting" | "heartwarming";

export type Lesson = "kindness" | "courage" | "sharing" | "honesty" | "perseverance";

export type LessonSelection = { type: "preset"; lessonId: Lesson } | { type: "custom"; text: string };

export type PillOption<T extends string> = {
  id: T;
  label: string;
};

import { StorySelections } from "./storyPrompt";
import { StoryLength } from "./types";

// The chosen story length maps to a BEAT RANGE, not a fixed count (#50). The story is free to end
// anywhere in [min, max]: it's soft-steered toward a natural resolution once inside the range, and
// hard-capped at max so interactive generation can never ramble forever.
export const LENGTH_BEAT_RANGE: Record<StoryLength, { min: number; max: number }> = {
  quick: { min: 4, max: 6 },
  longer: { min: 8, max: 12 },
};

export type ArcState = {
  min: number;
  max: number;
  // How many beats have been generated so far (beats.length); drives the progress bar.
  current: number;
};

// One interactive session, held entirely client-side (no accounts/DB this round). The full object
// is re-sent to /api/story-step each beat so generation stays consistent without server state, and
// persisted to localStorage so a refresh resumes mid-story.
export type InteractiveStory = {
  title: string;
  // The locked "character blueprint" - the immutable setup (character/genre/tone/lesson) re-injected
  // every step so multi-turn generation doesn't drift or contradict itself.
  selections: StorySelections;
  arc: ArcState;
  beats: string[];
  // The 3 model-suggested next directions for the current decision point (empty once ended).
  choices: string[];
  // Parallel to `beats`: beatChoices[i] is the set of choices that was offered AFTER beat i, so
  // "Go back a step" can restore the previous decision point's options without another API call.
  beatChoices: string[][];
  ended: boolean;
};

// What the reader did to advance one beat: let the storyteller decide (continue), pick a suggested
// direction (choice), or steer with free text. Choice/free-text text is untrusted user input.
export type StepAction =
  | { kind: "continue" }
  | { kind: "choice"; text: string }
  | { kind: "freeText"; text: string };

// The shape /api/story-step returns for a single beat.
export type StepResult = {
  title: string;
  beatText: string;
  choices: string[];
  isEnding: boolean;
};

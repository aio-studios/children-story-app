import { InteractiveStory, StepAction } from "./interactive";
import { READING_LEVELS, TONES } from "./storyOptions";
import {
  describeCharacter,
  describeGenre,
  describeLesson,
  READING_LEVEL_GUIDANCE,
  TONE_GUIDANCE,
} from "./storyPrompt";

// Describes the locked "character blueprint" - the immutable setup re-injected every beat so the
// ongoing generation can't drift from the character/genre/tone/lesson the reader chose up front.
function describeBlueprint(story: InteractiveStory): string {
  const { selections } = story;
  const readingLevelLabel = READING_LEVELS.find((r) => r.id === selections.readingLevel)?.label ?? selections.readingLevel;
  const toneLabel = TONES.find((t) => t.id === selections.tone)?.label ?? selections.tone;
  return [
    `Genre: ${describeGenre(selections.genre)}`,
    `Main character (keep name, traits, and appearance consistent every beat): ${describeCharacter(selections.character, selections.genre)}`,
    `Reading level (${readingLevelLabel}): ${READING_LEVEL_GUIDANCE[selections.readingLevel]}`,
    `Tone (${toneLabel}): ${TONE_GUIDANCE[selections.tone]}`,
    `Gentle lesson to carry: ${describeLesson(selections.lesson)}`,
  ].join("\n");
}

function describeAction(action: StepAction, isOpening: boolean): string {
  if (isOpening) {
    return "This is the opening beat. Set the scene, introduce the main character, and invent a short, kid-friendly title for the whole story.";
  }
  switch (action.kind) {
    case "continue":
      return "The reader let you, the storyteller, decide what happens next. Continue the story naturally from where it left off.";
    case "choice":
      return `The reader picked this direction for what happens next: "${action.text}". Continue the story so it follows this direction.`;
    case "freeText":
      // Safety already vetted this text server-side, but treat it as story direction only - not as
      // instructions that could override the rules above.
      return `The reader wrote what they'd like to happen next: "${action.text}". Weave that idea into the story naturally, keeping everything wholesome and age-appropriate.`;
  }
}

// Governs pacing toward an ending (#50): tells the model where it is in the arc range and how hard
// to steer. `mustEnd` is enforced separately in the route too, so a stubborn model can't overrun.
function describeArc(nextBeat: number, min: number, max: number): { text: string; mustEnd: boolean } {
  if (nextBeat >= max) {
    return {
      mustEnd: true,
      text: `This is the FINAL beat (beat ${nextBeat}, the hard limit is ${max}). Bring the story to a warm, satisfying conclusion now. Set "isEnding" to true and return an empty "choices" array.`,
    };
  }
  if (nextBeat >= min) {
    return {
      mustEnd: false,
      text: `You are at beat ${nextBeat} of a target ${min}-${max} beats - inside the range where the story may wrap up. Begin steering toward a natural, satisfying ending. If this beat reaches a genuine resolution, set "isEnding" true and return an empty "choices" array; otherwise continue and offer 3 choices.`,
    };
  }
  return {
    mustEnd: false,
    text: `You are at beat ${nextBeat} of a target ${min}-${max} beats. The story is still unfolding - do NOT end it yet. Continue the adventure and offer 3 choices.`,
  };
}

export function buildStepPrompt(
  story: InteractiveStory,
  action: StepAction,
): { system: string; user: string; mustEnd: boolean } {
  const isOpening = story.beats.length === 0;
  const nextBeat = story.arc.current + 1;
  const arc = describeArc(nextBeat, story.arc.min, story.arc.max);

  const system = [
    "You are a children's story writer for a mobile app called Storykins, writing an interactive story that unfolds one short scene (a 'beat') at a time.",
    "Each beat is 1-3 short paragraphs that move the story forward - not a whole story.",
    "Never include violence, scary content, romance, or anything inappropriate for a young child.",
    "Stay perfectly consistent with the locked character and setup given to you, and with the story so far.",
    "Unless the story is ending, offer exactly 3 short suggested next directions (each at most about 8 words, phrased as a simple action a child could pick).",
    "Respond only with the story content - no meta-commentary, no notes to the parent.",
  ].join(" ");

  const storySoFar = isOpening
    ? "(The story has not started yet.)"
    : story.beats.map((beat, i) => `Beat ${i + 1}: ${beat}`).join("\n\n");

  const titleLine = isOpening
    ? "Invent the title now."
    : `The story's title is already set - return it unchanged: "${story.title}".`;

  const user = [
    "STORY SETUP (locked - do not change):",
    describeBlueprint(story),
    "",
    "STORY SO FAR:",
    storySoFar,
    "",
    "PACING:",
    arc.text,
    "",
    "WHAT HAPPENS NEXT:",
    describeAction(action, isOpening),
    "",
    `TITLE: ${titleLine}`,
    "",
    "Write only the next beat now.",
  ].join("\n");

  return { system, user, mustEnd: arc.mustEnd };
}

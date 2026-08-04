import { describeCharacter, describeGenre, StorySelections } from "@/lib/storyPrompt";
import { TONES } from "@/lib/storyOptions";

// One fixed illustration style across every story so covers feel like one book series,
// and so per-scene images (#37, later) stay visually consistent with the cover.
const STYLE = [
  "Soft, warm children's picture-book illustration.",
  "Gentle watercolor and colored-pencil texture, rounded friendly shapes, cozy lighting.",
  "Wholesome and age-appropriate for young children. No text, letters, words, or logos in the image.",
  "A single storybook cover composition, not a collage or grid.",
].join(" ");

// Builds the text-to-image prompt for a story's cover. The character sheet reuses the exact
// character description the story was written from, so the illustrated character matches the tale.
export function buildImagePrompt(selections: StorySelections, title: string): string {
  const toneLabel = TONES.find((t) => t.id === selections.tone)?.label ?? selections.tone;

  return [
    STYLE,
    "",
    `Cover illustration for a children's story titled "${title.trim()}".`,
    `Main character (keep this appearance consistent): ${describeCharacter(selections.character, selections.genre)}.`,
    `Setting / genre: ${describeGenre(selections.genre)}.`,
    `Mood: ${toneLabel}.`,
    "Show the main character as the clear focal point in a scene that fits the story.",
  ].join("\n");
}

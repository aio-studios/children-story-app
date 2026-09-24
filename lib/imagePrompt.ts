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

// Describes the character WITHOUT naming them, for the nameless retry below. Only the name is
// dropped - the traits and description are the part an illustrator actually needs, and they carry
// no trademark. Reads as prose rather than "(traits) - description" so the missing name isn't a gap.
function describeCharacterNamelessly(character: StorySelections["character"], genre: StorySelections["genre"]): string {
  if (character.type === "custom") {
    return `${character.description.trim()}, who is ${character.traits.trim()}`;
  }
  // Presets are ours and safe to name, but the caller only reaches this path after a refusal, so
  // strip the name here too rather than guess which half Gemini objected to.
  const described = describeCharacter(character, genre);
  const dash = described.indexOf(" - ");
  return dash === -1 ? described : described.slice(dash + 3);
}

// Builds the text-to-image prompt for a story's cover. The character sheet reuses the exact
// character description the story was written from, so the illustrated character matches the tale.
//
// `nameless` is the retry after a refusal (#103): it drops the character's proper name AND the
// title, which are the two places a name reaches the image model - Gemini declines to draw a named
// copyrighted character, and the title is built from that same name, so dropping only one is no use.
// What remains describes the character rather than identifying them, which is what the cover needed
// anyway. Deliberately NOT a way to obtain the trademarked character: it asks for a different,
// generic one.
export function buildImagePrompt(selections: StorySelections, title: string, { nameless = false } = {}): string {
  const toneLabel = TONES.find((t) => t.id === selections.tone)?.label ?? selections.tone;
  const character = nameless
    ? describeCharacterNamelessly(selections.character, selections.genre)
    : describeCharacter(selections.character, selections.genre);

  return [
    STYLE,
    "",
    nameless
      ? "Cover illustration for a children's story."
      : `Cover illustration for a children's story titled "${title.trim()}".`,
    `Main character (keep this appearance consistent): ${character}.`,
    `Setting / genre: ${describeGenre(selections.genre)}.`,
    `Mood: ${toneLabel}.`,
    "Show the main character as the clear focal point in a scene that fits the story.",
  ].join("\n");
}

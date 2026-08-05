// One-time generator for the setup-flow art (#59): 15 character portraits + 5 genre scenes, in the
// fixed storybook style, written to docs/designs/source-art/ (the durable source of truth). Skips any
// file that already exists so approved assets are never regenerated (Nano Banana drifts between runs).
// Optimized JPEGs for the app are produced separately by scripts/optimize-art.mjs.
// Run: node --env-file=.env.local scripts/generate-art.mjs
import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { writeFile, mkdir, access } from "node:fs/promises";

const OUT = new URL("../docs/designs/source-art/", import.meta.url).pathname;

// Fixed style, mirrors lib/imagePrompt.ts so this art matches the #38 story covers.
const STYLE = [
  "Soft, warm children's picture-book illustration.",
  "Gentle watercolor and colored-pencil texture, rounded friendly shapes, cozy lighting.",
  "Wholesome and age-appropriate for young children. No text, letters, words, or logos in the image.",
].join(" ");

function characterPrompt(name, description) {
  return [
    STYLE,
    "A single character portrait for a circular avatar.",
    `Character: ${name} - ${description}.`,
    "Head and shoulders, centered, facing forward, filling the frame with a friendly expression.",
    "Simple soft pastel background. One character only, no scene clutter, no text.",
  ].join("\n");
}

// Full-bleed scene that fills the whole square to every edge, so cropping into a round orb keeps the
// subject centered and never chops a border/frame.
function genrePrompt(label, subject, extra) {
  return [
    STYLE,
    `A soft painterly scene representing the "${label}" genre for a children's app.`,
    `Subject: ${subject}.`,
    "The painting fills the entire square all the way to every edge - no border, no frame, no letterbox, no rounded-corner icon tile, no white margin.",
    `Centered composition with the background color bleeding to all four edges. ${extra}`,
  ].join("\n");
}

// file = source basename; genre files map genre id "sci-fi" -> "genre-scifi".
const CHARACTERS = [
  ["char-finn", "Finn the Explorer", "A quick-footed boy with a compass that always points to somewhere exciting, never lost even when he doesn't know where he's going."],
  ["char-zara", "Zara the Trailblazer", "A brave girl who's mapped every cave within a mile of home and is always ready to chart one more."],
  ["char-pip", "Pip the Mountain Goat", "A sure-footed little goat who's climbed higher than anyone else in the valley and loves showing the way."],
  ["char-oren", "Prince Oren", "A young prince who'd rather befriend a dragon than fight one, armed with kindness instead of a sword."],
  ["char-luna", "Luna the Apprentice Witch", "A curious young witch still learning her spells, more likely to turn a pumpkin into a friend than a carriage."],
  ["char-ember", "Ember the Baby Dragon", "A small dragon who can only blow tiny sparks instead of fire, but has a giant heart."],
  ["char-baxter", "Baxter the Bear Cub", "A clumsy, gentle bear cub who's always hungry for honey and hugs."],
  ["char-coco", "Coco the Clever Fox", "A quick-witted little fox who knows every shortcut through the forest."],
  ["char-nimbus", "Nimbus the Cloud Sheep", "A fluffy sheep who's convinced he's part cloud, and loves to nap on hilltops."],
  ["char-sammy", "Sammy the Sleepy Otter", "A little otter who fights his yawns every night but always loses (happily) to sleep."],
  ["char-willow", "Willow the Moon Fairy", "A gentle fairy who sprinkles dream-dust over rooftops every night to bring sweet dreams."],
  ["char-snug", "Snug the Blanket Owl", "A round, soft owl who wraps its wings around anyone who needs a goodnight hug."],
  ["char-cosmo", "Cosmo the Space Cadet", "A cheerful young astronaut-in-training who's more excited about aliens than afraid of them."],
  ["char-nova", "Nova the Robot Engineer", "A brilliant girl who builds gadgets out of everything, including her very own robot best friend."],
  ["char-blip", "Blip the Star Critter", "A tiny, bouncy space creature made of starlight who communicates in cheerful beeps."],
].map(([file, name, description]) => ({ file, prompt: characterPrompt(name, description) }));

const GENRES = [
  ["genre-adventure", "Adventure", "a tall grassy mountain peak with a small pennant flag planted at the very top, a winding dirt trail climbing up toward it, and a colorful hot-air balloon drifting in a bright blue sky with a few fluffy clouds and a warm sun", "Bright, inviting and adventurous. No people, no text."],
  ["genre-fantasy", "Fantasy", "a whimsical fairytale castle with soft sparkles and a gentle rainbow over an enchanted forest", "No people, no text."],
  ["genre-animals", "Animals", "a cozy sunny green meadow with a few friendly cute woodland animals gathered together - a little orange fox, a small brown bear cub, a white bunny rabbit and a tiny bird - among soft wildflowers and gentle rolling hills on a bright day", "The animals are the clear focus, cute and smiling. No people, no text."],
  ["genre-bedtime", "Bedtime", "a calm glowing crescent moon and gentle stars above soft dreamy clouds in a deep blue night sky", "No people, no text."],
  ["genre-scifi", "Sci-fi", "a friendly little rocket drifting among round colorful planets and twinkling stars in a bright cosmic sky", "No people, no text."],
].map(([file, label, subject, extra]) => ({ file, prompt: genrePrompt(label, subject, extra) }));

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

await mkdir(OUT, { recursive: true });
let made = 0, skipped = 0;
for (const { file, prompt } of [...CHARACTERS, ...GENRES]) {
  if (await exists(`${OUT}${file}.png`)) { console.log(`skip ${file} (already approved)`); skipped++; continue; }
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    process.stdout.write(`generate ${file} (try ${attempt})... `);
    try {
      const { image } = await generateImage({ model: google.image("gemini-2.5-flash-image"), prompt, aspectRatio: "1:1" });
      await writeFile(`${OUT}${file}.png`, Buffer.from(image.uint8Array));
      console.log(`ok (${Math.round(image.uint8Array.length / 1024)}KB)`);
      made++; ok = true;
    } catch (err) {
      console.log(`fail: ${(err?.message ?? "").slice(0, 50)}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (!ok) console.log(`  !! gave up on ${file}`);
}
console.log(`\nDone -> ${OUT}\nGenerated ${made}, skipped ${skipped}.`);

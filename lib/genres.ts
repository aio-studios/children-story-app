import { Genre, GenreAccent } from "./types";

export const GENRES: Genre[] = [
  {
    id: "adventure",
    label: "Adventure",
    icon: "🗺️",
    accent: { light: "#B85C27", dark: "#E8A06B" },
    image: "/genres/adventure.jpg",
    blurb:
      "The map is unrolled and the boots are laced — somewhere past the hill, an adventure is waiting to be found.",
    characters: [
      {
        id: "finn",
        name: "Finn the Explorer",
        image: "/characters/finn.jpg",
        description:
          "A quick-footed boy with a compass that always points to somewhere exciting, never lost even when he doesn't know where he's going.",
      },
      {
        id: "zara",
        name: "Zara the Trailblazer",
        image: "/characters/zara.jpg",
        description:
          "A brave girl who's mapped every cave within a mile of home and is always ready to chart one more.",
      },
      {
        id: "pip",
        name: "Pip the Mountain Goat",
        image: "/characters/pip.jpg",
        description:
          "A sure-footed little goat who's climbed higher than anyone else in the valley and loves showing the way.",
      },
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    icon: "🐉",
    accent: { light: "#7B4C9E", dark: "#C79EE8" },
    image: "/genres/fantasy.jpg",
    blurb:
      "Beyond the old oak door, where the light bends strangely, a kingdom of magic waits for someone brave enough to knock.",
    characters: [
      {
        id: "oren",
        name: "Prince Oren",
        image: "/characters/oren.jpg",
        description:
          "A young prince who'd rather befriend a dragon than fight one, armed with kindness instead of a sword.",
      },
      {
        id: "luna",
        name: "Luna the Apprentice Witch",
        image: "/characters/luna.jpg",
        description:
          "A curious young witch still learning her spells, more likely to turn a pumpkin into a friend than a carriage.",
      },
      {
        id: "ember",
        name: "Ember the Baby Dragon",
        image: "/characters/ember.jpg",
        description:
          "A small dragon who can only blow tiny sparks instead of fire, but has a giant heart.",
      },
    ],
  },
  {
    id: "animals",
    label: "Animals",
    icon: "🦊",
    accent: { light: "#4C7A3F", dark: "#93CC7E" },
    image: "/genres/animals.jpg",
    blurb:
      "Deep in the meadow where the tall grass sways, the animals are just waking up for a day full of surprises.",
    characters: [
      {
        id: "baxter",
        name: "Baxter the Bear Cub",
        image: "/characters/baxter.jpg",
        description: "A clumsy, gentle bear cub who's always hungry for honey and hugs.",
      },
      {
        id: "coco",
        name: "Coco the Clever Fox",
        image: "/characters/coco.jpg",
        description: "A quick-witted little fox who knows every shortcut through the forest.",
      },
      {
        id: "nimbus",
        name: "Nimbus the Cloud Sheep",
        image: "/characters/nimbus.jpg",
        description: "A fluffy sheep who's convinced he's part cloud, and loves to nap on hilltops.",
      },
    ],
  },
  {
    id: "bedtime",
    label: "Bedtime",
    icon: "🌙",
    accent: { light: "#3E4E86", dark: "#9AAEEF" },
    image: "/genres/bedtime.jpg",
    blurb:
      "The stars are blinking on one by one, and the whole world is getting ready for the softest part of the day.",
    characters: [
      {
        id: "sammy",
        name: "Sammy the Sleepy Otter",
        image: "/characters/sammy.jpg",
        description: "A little otter who fights his yawns every night but always loses (happily) to sleep.",
      },
      {
        id: "willow",
        name: "Willow the Moon Fairy",
        image: "/characters/willow.jpg",
        description: "A gentle fairy who sprinkles dream-dust over rooftops every night to bring sweet dreams.",
      },
      {
        id: "snug",
        name: "Snug the Blanket Owl",
        image: "/characters/snug.jpg",
        description: "A round, soft owl who wraps its wings around anyone who needs a goodnight hug.",
      },
    ],
  },
  {
    id: "sci-fi",
    label: "Sci-fi",
    icon: "🚀",
    accent: { light: "#1D7A8C", dark: "#7BDCEA" },
    image: "/genres/sci-fi.jpg",
    blurb:
      "The countdown has started, the stars are close enough to touch, and a brand-new galaxy is just one launch away.",
    characters: [
      {
        id: "cosmo",
        name: "Cosmo the Space Cadet",
        image: "/characters/cosmo.jpg",
        description: "A cheerful young astronaut-in-training who's more excited about aliens than afraid of them.",
      },
      {
        id: "nova",
        name: "Nova the Robot Engineer",
        image: "/characters/nova.jpg",
        description: "A brilliant girl who builds gadgets out of everything, including her very own robot best friend.",
      },
      {
        id: "blip",
        name: "Blip the Star Critter",
        image: "/characters/blip.jpg",
        description: "A tiny, bouncy space creature made of starlight who communicates in cheerful beeps.",
      },
    ],
  },
];

// Used for the reading view's genre badge when the user typed a custom genre with no GENRES entry to theme from.
export const CUSTOM_GENRE_ACCENT: GenreAccent = { light: "#8A6D3B", dark: "#D9B876" };

export function getGenreById(genreId: string): Genre | undefined {
  return GENRES.find((g) => g.id === genreId);
}

// Shared by StoryReader (reading-view badge) and HomeScreen (shelves/hero/genre strip) so genre
// accent-color lookup has one implementation instead of two that can drift.
export function getGenreAccent(genreId: string): GenreAccent {
  return getGenreById(genreId)?.accent ?? CUSTOM_GENRE_ACCENT;
}

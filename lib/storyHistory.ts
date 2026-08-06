import { useSyncExternalStore } from "react";
import { InteractiveStory } from "./interactive";
import { GenreSelection, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, Tone } from "./types";

const CONTINUE_STORY_KEY = "storykins:continue-story";

// Keeps the full selection set (not just genre) so resuming a story and hitting "Regenerate"
// reuses the exact original setup instead of pairing a restored genre with stale/default character state.
export type ClassicContinueStory = {
  // Absent on stories saved before interactive mode existed - treated as classic (see isValid* below).
  mode?: "classic";
  title: string;
  story: string;
  genre: GenreSelection;
  character: SelectedCharacter;
  length: StoryLength;
  readingLevel: ReadingLevel;
  tone: Tone;
  lesson: LessonSelection;
  // Optional: only present when the story was generated with an illustration (#38). A resumed
  // story restores its cover from here without re-generating (and re-paying for) the image.
  imageUrl?: string;
  savedAt: number;
};

// An in-progress (or finished) interactive story (#37), so Home can resume it mid-beat.
export type InteractiveContinueStory = {
  mode: "interactive";
  interactive: InteractiveStory;
  imageUrl?: string;
  savedAt: number;
};

export type ContinueStory = ClassicContinueStory | InteractiveContinueStory;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// useSyncExternalStore requires getSnapshot to return a stable reference when the underlying
// value hasn't changed - cache the parsed value against the raw string so repeated reads between
// writes return the same object instead of a fresh one from JSON.parse every call.
let cachedRaw: string | null = null;
let cachedValue: ContinueStory | null = null;

// Shallow shape check so a structurally-incompatible stored value (a future schema change,
// hand-edited localStorage) falls back to "no continue story" instead of crashing downstream
// on an unexpected shape.
function isValidClassic(v: Record<string, unknown>): boolean {
  return (
    typeof v.title === "string" &&
    typeof v.story === "string" &&
    typeof v.genre === "object" &&
    typeof v.character === "object" &&
    typeof v.length === "string" &&
    typeof v.readingLevel === "string" &&
    typeof v.tone === "string" &&
    typeof v.lesson === "object" &&
    (v.imageUrl === undefined || typeof v.imageUrl === "string") &&
    typeof v.savedAt === "number"
  );
}

function isValidArc(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const arc = value as Record<string, unknown>;
  return typeof arc.min === "number" && typeof arc.max === "number" && typeof arc.current === "number";
}

function isValidInteractive(v: Record<string, unknown>): boolean {
  const s = v.interactive;
  if (typeof s !== "object" || s === null) return false;
  const story = s as Record<string, unknown>;
  return (
    typeof story.title === "string" &&
    typeof story.selections === "object" &&
    story.selections !== null &&
    isValidArc(story.arc) &&
    Array.isArray(story.beats) &&
    Array.isArray(story.choices) &&
    typeof story.ended === "boolean" &&
    (v.imageUrl === undefined || typeof v.imageUrl === "string") &&
    typeof v.savedAt === "number"
  );
}

function isValidContinueStory(value: unknown): value is ContinueStory {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.mode === "interactive" ? isValidInteractive(v) : isValidClassic(v);
}

function parseSnapshot(raw: string | null): ContinueStory | null {
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = null;
    return cachedValue;
  }
  try {
    const parsed = JSON.parse(raw);
    cachedValue = isValidContinueStory(parsed) ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

// localStorage access itself (not just quota) can throw - Safari private browsing, Lockdown
// Mode, strict storage-blocking policies. Treat any failure here as "no continue story" rather
// than letting it crash the Home render or swallow an otherwise-successful story generation.
function getSnapshot(): ContinueStory | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CONTINUE_STORY_KEY);
  } catch {
    raw = null;
  }
  return parseSnapshot(raw);
}

function getServerSnapshot(): ContinueStory | null {
  return null;
}

// Distributes Omit across the union so each variant keeps its discriminant while dropping savedAt.
type Saveable<T> = T extends unknown ? Omit<T, "savedAt"> : never;

// The store stamps its own save time, so callers never call Date.now() (an impure call the
// react-hooks purity rule rightly flags inside a component's render closure).
export function saveContinueStory(story: Saveable<ContinueStory>) {
  try {
    window.localStorage.setItem(CONTINUE_STORY_KEY, JSON.stringify({ ...story, savedAt: Date.now() }));
  } catch {
    return;
  }
  notify();
}

export function clearContinueStory() {
  try {
    window.localStorage.removeItem(CONTINUE_STORY_KEY);
  } catch {
    return;
  }
  notify();
}

export function useContinueStory(): ContinueStory | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Slot accessors that work across both variants, so Home can render one "Continue" card without
// caring whether the in-progress story is classic or interactive.
export function getContinueTitle(slot: ContinueStory): string {
  return slot.mode === "interactive" ? slot.interactive.title : slot.title;
}

export function getContinueGenre(slot: ContinueStory): GenreSelection {
  return slot.mode === "interactive" ? slot.interactive.selections.genre : slot.genre;
}

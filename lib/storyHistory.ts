import { useSyncExternalStore } from "react";
import { InteractiveStory } from "./interactive";
import { GenreSelection, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, Tone } from "./types";

const CONTINUE_STORY_KEY = "storykins:continue-story";
// "Has ever created a story" - persisted separately from the continue-slot so a returning user who
// finished (and thus cleared) their story still gets a returning greeting, not "make your first
// story" (#82 part 1). The slot comes and goes; this flag is sticky.
const HAS_CREATED_KEY = "storykins:has-created";

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
  // How far the reader has read, 0-1 (from scroll position for classic, arc progress for
  // interactive). Feeds Home's Continue card % + bar (#61, D3). Absent on stories saved before this
  // existed - treated as 0 (see getContinueProgress).
  progress?: number;
  // Cumulative active reading time (ms), accumulated by the classic reader across sessions. Gates
  // "complete" together with progress so a quick fast-scroll to the bottom doesn't retire the card
  // before the story was actually read (UAT). Absent = 0.
  timeSpent?: number;
  savedAt: number;
};

// An in-progress (or finished) interactive story (#37), so Home can resume it mid-beat.
export type InteractiveContinueStory = {
  mode: "interactive";
  interactive: InteractiveStory;
  imageUrl?: string;
  progress?: number;
  timeSpent?: number;
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
    (v.progress === undefined || typeof v.progress === "number") &&
    (v.timeSpent === undefined || typeof v.timeSpent === "number") &&
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
    (v.progress === undefined || typeof v.progress === "number") &&
    (v.timeSpent === undefined || typeof v.timeSpent === "number") &&
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
    // Sticky "has ever created" flag for the greeting (#82) - set alongside the slot, but never
    // cleared by clearContinueStory, so finishing a story doesn't revert Home to "first story".
    window.localStorage.setItem(HAS_CREATED_KEY, "1");
  } catch {
    return;
  }
  notify();
}

// Merges the reader's LAST position (0-1) + cumulative active reading time (ms) into the EXISTING
// slot, without touching its story/cover/savedAt. `timeSpentMs` is absolute (the reader passes
// base-at-mount + this-session), so repeated throttled calls are idempotent, not additive. No-op when
// there's no slot or it's unreadable, so a stray call can never create or corrupt one.
// Position is last-left (not furthest): the reader restores this exact spot on resume (see
// StoryReader), so "left at 40%, come back" reopens at 40% and the card reflects it (UAT 2026-08-07).
export function saveProgress(fraction: number, timeSpentMs: number) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const time = Math.max(0, Math.round(timeSpentMs));
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CONTINUE_STORY_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isValidContinueStory(parsed)) return;
  if (parsed.progress === clamped && parsed.timeSpent === time) return; // no change - skip the write
  // No notify() on purpose: Home isn't mounted while reading, and it reads fresh progress via
  // getSnapshot when it (re)mounts on navigation. A live notify here would only re-render the reader
  // (through page's useContinueStory subscription) on every throttled write, for no benefit.
  try {
    window.localStorage.setItem(CONTINUE_STORY_KEY, JSON.stringify({ ...parsed, progress: clamped, timeSpent: time }));
  } catch {
    return;
  }
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

// Reuses the same listener set (saveContinueStory calls notify()), so Home re-renders the greeting
// the moment the flag flips. SSR/first paint assume false and reconcile on mount.
function getHasCreatedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(HAS_CREATED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useHasCreatedStory(): boolean {
  return useSyncExternalStore(subscribe, getHasCreatedSnapshot, () => false);
}

// Slot accessors that work across both variants, so Home can render one "Continue" card without
// caring whether the in-progress story is classic or interactive.
export function getContinueTitle(slot: ContinueStory): string {
  return slot.mode === "interactive" ? slot.interactive.title : slot.title;
}

export function getContinueGenre(slot: ContinueStory): GenreSelection {
  return slot.mode === "interactive" ? slot.interactive.selections.genre : slot.genre;
}

// Back-compat: a slot saved before `progress` existed (or a hand-edited one) reads as 0. Clamped so
// a bad stored value can't overflow the Continue card's bar.
export function getContinueProgress(slot: ContinueStory): number {
  return typeof slot.progress === "number" ? Math.max(0, Math.min(1, slot.progress)) : 0;
}

export function getContinueTimeSpent(slot: ContinueStory): number {
  return typeof slot.timeSpent === "number" && slot.timeSpent > 0 ? slot.timeSpent : 0;
}

// A finished story shouldn't offer "Continue" (UAT 2026-08-07). Interactive = reached its ending.
// Classic requires BOTH scrolled-to-the-end AND enough time spent (2 min quick / 10 min longer) - a
// quick fast-scroll to the bottom (or a short story that fits one screen, which reads as 100% at once)
// mustn't retire the card before the story was actually read.
const SCROLL_COMPLETE = 0.98;
const READ_TIME_MS: Record<StoryLength, number> = { quick: 2 * 60_000, longer: 10 * 60_000 };
export function isContinueComplete(slot: ContinueStory): boolean {
  if (slot.mode === "interactive") return slot.interactive.ended;
  return getContinueProgress(slot) >= SCROLL_COMPLETE && getContinueTimeSpent(slot) >= READ_TIME_MS[slot.length];
}

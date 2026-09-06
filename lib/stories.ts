import { InteractiveStory } from "./interactive";
import { StorySelections } from "./storyPrompt";
import { ContinueStory, isValidContinueStory } from "./storyHistory";

// Maps between the app's client-side story shape (`ContinueStory`, the same union localStorage has
// always held) and a row of `public.stories`. Nothing here talks to Supabase - it is pure mapping, so
// it can be unit-tested without a database and reused by both the browser and server clients.
//
// The split between the two jsonb columns is deliberate:
//   `selections` - the immutable setup (genre/character/length/readingLevel/tone/lesson). Identical
//                  for both modes, which is why the Library can render a card for either without
//                  first discriminating on mode.
//   `content`    - the mode-specific payload, and the only part whose shape depends on `mode`.
// Splitting them this way means the Library's list query can one day select `selections` alone and
// skip dragging every beat of every story over the wire.

export type StoryRow = {
  id: string;
  user_id: string;
  mode: "classic" | "interactive";
  title: string;
  selections: StorySelections;
  content: Record<string, unknown>;
  image_url: string | null;
  progress: number;
  time_spent: number;
  opened: boolean;
  created_at: string;
  updated_at: string;
};

// What an insert sends. `id`, `created_at` and `updated_at` are all database-generated - `updated_at`
// especially must never be written by the client, since the eviction order depends on it (migration
// 002's trigger overrides any value we send, by design).
export type StoryInsert = Omit<StoryRow, "id" | "created_at" | "updated_at">;

// The columns that describe the story itself, without the two that describe its place in the
// library. Split out so an in-place update (regenerating an unread story, attaching a cover once it
// finishes) can reuse the exact same mapping without inventing a `user_id` it has no business
// setting - a row's owner is fixed at insert, and `opened` is owned by the reader, not the writer.
export type StoryColumns = Omit<StoryInsert, "user_id" | "opened">;

// The story's own content, WITHOUT how far through it someone is. Split out because those two move
// on completely different schedules: content changes when a beat is added or a cover finishes, while
// progress changes every few seconds as someone reads. An update that carried both would PATCH
// `progress: 0` over a reader's real position every time a late cover landed.
export type StoryContentColumns = Omit<StoryColumns, "progress" | "time_spent">;
export type StoryProgressColumns = Pick<StoryColumns, "progress" | "time_spent">;

// A row brought back into app shape, plus the two things only the database knows: which row this is,
// and whether it has ever been opened (which decides if a regenerate replaces it in place).
export type SavedStory = ContinueStory & { id: string; opened: boolean };

// Distributes across the union so each variant keeps its discriminant while dropping the
// localStorage-only timestamp - same trick as storyHistory's `Saveable`.
type WithoutSavedAt<T> = T extends unknown ? Omit<T, "savedAt"> : never;

export function toRow(story: WithoutSavedAt<ContinueStory>, userId: string, opened = false): StoryInsert {
  return { ...toColumns(story), user_id: userId, opened };
}

export function toColumns(story: WithoutSavedAt<ContinueStory>): StoryColumns {
  return { ...toContentColumns(story), ...toProgressColumns(story) };
}

// Columns are NOT NULL with defaults, so an absent optional becomes 0 rather than a null every
// reader would then have to coalesce.
export function toProgressColumns(story: WithoutSavedAt<ContinueStory>): StoryProgressColumns {
  return {
    progress: clampProgress(story.progress),
    time_spent: Math.max(0, Math.round(story.timeSpent ?? 0)),
  };
}

export function toContentColumns(story: WithoutSavedAt<ContinueStory>): StoryContentColumns {
  const shared = {
    image_url: story.imageUrl ?? null,
  };

  if (story.mode === "interactive") {
    const { title, selections, arc, beats, choices, beatChoices, ended } = story.interactive;
    return {
      ...shared,
      mode: "interactive",
      title,
      selections,
      content: { arc, beats, choices, beatChoices, ended },
    };
  }

  const { genre, character, length, readingLevel, tone, lesson } = story;
  return {
    ...shared,
    mode: "classic",
    title: story.title,
    selections: { genre, character, length, readingLevel, tone, lesson },
    content: { story: story.story },
  };
}

// Returns null rather than throwing on a row that doesn't round-trip. A single malformed row must
// degrade to "that one story is missing" - it must not take down the whole Library, which is exactly
// what an exception mid-`map` would do.
export function fromRow(row: StoryRow): SavedStory | null {
  const shared = {
    imageUrl: row.image_url ?? undefined,
    progress: clampProgress(row.progress),
    timeSpent: Math.max(0, Math.round(row.time_spent ?? 0)),
    // The app's shape carries `savedAt` as an epoch number; the column is a timestamptz string. An
    // unparseable value would be NaN, which is `typeof number` and would sail straight through the
    // validator below, so it is caught here instead.
    savedAt: parseTimestamp(row.updated_at),
  };

  const candidate =
    row.mode === "interactive"
      ? { ...shared, mode: "interactive" as const, interactive: toInteractive(row) }
      : { ...shared, mode: "classic" as const, title: row.title, ...row.selections, story: row.content?.story };

  // Validated against the same predicate localStorage slots go through, so a row and a slot can
  // never disagree about what a valid story is.
  if (!isValidContinueStory(candidate)) return null;

  return { ...candidate, id: row.id, opened: row.opened };
}

function toInteractive(row: StoryRow): InteractiveStory {
  const c = row.content ?? {};
  return {
    title: row.title,
    selections: row.selections,
    arc: c.arc,
    beats: c.beats,
    choices: c.choices,
    // Predates nothing today, but `beatChoices` is the one field isValidInteractive does not assert,
    // so a row missing it would otherwise pass validation and hand the reader `undefined` the first
    // time someone stepped back a beat.
    beatChoices: Array.isArray(c.beatChoices) ? c.beatChoices : [],
    ended: c.ended,
  } as InteractiveStory;
}

function clampProgress(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

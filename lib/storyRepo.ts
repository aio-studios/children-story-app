import { createClient } from "./supabase/client";
import { deleteCoverBlob } from "./coverBlob";
import { ContinueStory } from "./storyHistory";
import { fromRow, toContentColumns, toRow, SavedStory, StoryRow } from "./stories";

// Data access for `public.stories`. Every Supabase call for stories lives here, so the hooks stay
// React-shaped and the mappers in stories.ts stay database-free.
//
// SECURITY: none of these filter by user_id on read. That is deliberate, not an oversight - RLS does
// it in Postgres, and a client-side `.eq("user_id", …)` would only be decoration over the real
// control. The one place user_id appears is the insert, where the column is NOT NULL and the
// `with check` policy verifies it matches the caller.
//
// These throw on failure rather than returning null. A caller that must not break the app (auto-save
// on create) catches; a caller that has a UI for it (the Library) surfaces the message.

// Distributes across the union so each variant keeps its discriminant - same trick as elsewhere.
type WithoutSavedAt<T> = T extends unknown ? Omit<T, "savedAt"> : never;

const COLUMNS = "id,user_id,mode,title,selections,content,image_url,progress,time_spent,opened,created_at,updated_at";

// How many stories a signed-in user keeps. Anything past this is evicted oldest-first by
// `updated_at` - the same order the Library lists them in, so the story about to go is always the
// last card on screen rather than a surprise from the middle.
export const LIBRARY_LIMIT = 20;

// Ceiling on how many rows one eviction pass will remove. Normally it deletes exactly one (a save
// pushed the count from 20 to 21); the headroom is for a library that drifted over the cap while
// evictions were failing, so it still converges instead of trimming one row per save forever.
const EVICTION_BATCH = 50;

// What the caller knows about the row currently backing the story on screen. Deliberately does NOT
// carry the cover URL: the client's copy of it lags the database by a round trip (a cover that has
// just been generated is on screen before the PATCH attaching it has committed), and deciding what
// to delete from a stale value is how a saved story loses its cover. The row itself is the authority.
export type PreviousRow = { id: string; opened: boolean };

function fail(action: string, message: string): never {
  // The raw Supabase message goes to the console for us; callers show their own copy to the user.
  console.error(`stories: ${action} failed —`, message);
  throw new Error(message);
}

// Newest-first by `updated_at`, which is the same order eviction uses - so the story about to be
// evicted is always the last one on this list, never a surprise from the middle.
export async function listStories(): Promise<SavedStory[]> {
  const { data, error } = await createClient()
    .from("stories")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .returns<StoryRow[]>();

  if (error) fail("list", error.message);

  // A row that doesn't map is dropped, not thrown on: one corrupt story costs one card, not the
  // whole Library. fromRow already logs nothing, so count them here to make the loss visible.
  const mapped = (data ?? []).map(fromRow);
  const usable = mapped.filter((story): story is SavedStory => story !== null);
  if (usable.length !== mapped.length) {
    console.warn(`stories: ${mapped.length - usable.length} row(s) failed to map and were skipped`);
  }
  return usable;
}

// Returns null for "no such story", which under RLS also covers "someone else's story" - the row
// simply isn't visible, so this cannot be used to probe whether an id exists.
export async function getStory(id: string): Promise<SavedStory | null> {
  const { data, error } = await createClient()
    .from("stories")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<StoryRow>();

  // 22P02 is "invalid input syntax for type uuid" - a hand-typed or stale URL, not an outage. It
  // must read as not-found, or the reader offers a Try again that can never succeed.
  if (error && error.code === "22P02") return null;
  if (error) fail("get", error.message);
  return data ? fromRow(data) : null;
}

export async function insertStory(
  story: WithoutSavedAt<ContinueStory>,
  userId: string,
  opened = false,
): Promise<SavedStory> {
  const { data, error } = await createClient()
    .from("stories")
    .insert(toRow(story, userId, opened))
    .select(COLUMNS)
    .single<StoryRow>();

  if (error) fail("insert", error.message);

  const saved = fromRow(data);
  // The row we just wrote failing to map back means the mapper and the schema disagree. That is a
  // bug on our side, not a bad row, and it should be loud.
  if (!saved) fail("insert", "the saved story could not be read back");
  return saved;
}

// Overwrites the CONTENT of the row backing the story on screen: a cover finishing after the story
// is already being read, another interactive beat. Deliberately does not touch progress/time_spent
// (saveStoryProgress owns those - a late cover must not reset how far someone has read), nor
// `user_id` (fixed at insert) or `opened`.
export async function updateStory(id: string, story: WithoutSavedAt<ContinueStory>): Promise<SavedStory> {
  const { data, error } = await createClient()
    .from("stories")
    .update(toContentColumns(story))
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle<StoryRow>();

  if (error) fail("update", error.message);
  // RLS turns "not yours" into zero rows rather than an error, and a story deleted in another tab
  // looks identical. Both mean the same thing to the caller: this row is gone, stop syncing to it.
  if (!data) fail("update", "that story no longer exists");

  const saved = fromRow(data);
  if (!saved) fail("update", "the saved story could not be read back");
  return saved;
}

// Saves a NEWLY generated story - a first generation, or a regenerate.
//
// Regenerating replaces the previous row in place, but ONLY if nobody ever opened it. Hitting
// "Try again" three times before reading should leave one story in the library, not three drafts;
// but a story someone actually read is theirs to keep, and the regenerate becomes a new row beside it.
export async function saveNewStory(
  story: WithoutSavedAt<ContinueStory>,
  userId: string,
  previous: PreviousRow | null,
): Promise<SavedStory> {
  if (previous && !previous.opened) {
    // Read the cover this row ACTUALLY points at, immediately before overwriting it. Postgres
    // UPDATE ... RETURNING gives back the new row, not the old one, and the client's cached value
    // can be a round trip behind - so the pre-update value is fetched here rather than passed in.
    const displaced = await currentCover(previous.id);
    const saved = await updateStory(previous.id, story);
    // Nothing references `displaced` any more: that row was its only reference and now points
    // somewhere else (usually nowhere - a freshly generated story has no cover yet). Deleted only
    // AFTER the update commits, so a failed update leaves the story on screen with its cover intact.
    if (displaced && displaced !== saved.imageUrl) deleteCoverBlob(displaced);
    return saved;
  }
  return insertStory(story, userId);
}

// The cover a row currently points at. Its own query rather than a field on the caller's cached row:
// this is read at the exact moment a cover is about to be orphaned, and a stale answer here either
// leaks a Blob or deletes one a saved story still needs. Returns null if the row is gone, which
// correctly means "nothing to clean up".
async function currentCover(id: string): Promise<string | null> {
  const { data, error } = await createClient()
    .from("stories")
    .select("image_url")
    .eq("id", id)
    .maybeSingle<Pick<StoryRow, "image_url">>();

  if (error) fail("read cover", error.message);
  return data?.image_url ?? null;
}

// Set once, when the reader actually mounts. This is what makes "regenerate replaces the unread
// story in place" safe: a story someone has opened is never silently overwritten.
export async function markOpened(id: string): Promise<void> {
  const { error } = await createClient().from("stories").update({ opened: true }).eq("id", id);
  if (error) fail("markOpened", error.message);
}

// Mirrors storyHistory.saveProgress: `timeSpent` is absolute, not a delta, so repeated throttled
// calls are idempotent. Touching a row bumps `updated_at` via migration 002's trigger, which is what
// keeps the story being read at the front of the eviction queue rather than aging out mid-read.
export async function saveStoryProgress(id: string, progress: number, timeSpentMs: number): Promise<void> {
  const { error } = await createClient()
    .from("stories")
    .update({
      progress: Math.max(0, Math.min(1, progress)),
      time_spent: Math.max(0, Math.round(timeSpentMs)),
    })
    .eq("id", id);
  if (error) fail("saveProgress", error.message);
}

// Deleting a story takes its cover with it - a user delete, an eviction, or an account delete.
//
// Row first, Blob second, and only if the row actually went: a Blob deleted ahead of a row that
// survives is a visible story with a permanently broken cover, while the reverse leaves an orphan
// costing a fraction of a cent. The endpoint independently refuses any URL a row still points at
// (migration 003), so this ordering is enforced on both sides.
export async function deleteStory(id: string, imageUrl?: string | null): Promise<void> {
  const { error } = await createClient().from("stories").delete().eq("id", id);
  if (error) fail("delete", error.message);
  deleteCoverBlob(imageUrl);
}

// Trims the library back to `limit`, deleting each evicted row's cover with it. Returns how many
// were removed so the caller can skip a refresh when nothing changed.
//
// The story that just triggered this is structurally safe: it was written moments ago, so migration
// 002's trigger puts it at the top of the `updated_at` order and it can never fall in the tail. The
// same is true of a story being read, whose progress writes keep bumping the column.
export async function evictBeyondLimit(limit = LIBRARY_LIMIT): Promise<number> {
  // Deliberately not listStories(): that maps rows and silently drops any that fail, so a corrupt
  // row would be invisible here and the library would sit permanently over the cap with no way to
  // trim it. Eviction needs two columns and an order, not a mapper.
  const { data, error } = await createClient()
    .from("stories")
    .select("id,image_url")
    .order("updated_at", { ascending: false })
    .range(limit, limit + EVICTION_BATCH - 1)
    .returns<Pick<StoryRow, "id" | "image_url">[]>();

  if (error) fail("evict", error.message);

  const stale = data ?? [];
  // Sequential rather than Promise.all: this is almost always one row, and a failure part-way must
  // not abandon the rows already deleted. Each is counted only once it is actually gone, so the
  // caller refreshes on a partial pass instead of leaving deleted stories on screen; the remainder
  // is retried by the next save.
  let evicted = 0;
  for (const row of stale) {
    try {
      await deleteStory(row.id, row.image_url);
      evicted++;
    } catch {
      // Already logged by fail(). Keep going: the next row may well delete cleanly.
    }
  }
  return evicted;
}

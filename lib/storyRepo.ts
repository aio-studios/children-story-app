import { createClient } from "./supabase/client";
import { ContinueStory } from "./storyHistory";
import { fromRow, toRow, SavedStory, StoryRow } from "./stories";

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

// The cover blob is NOT deleted here. Blob cleanup is Step 5's job and has to survive a failed row
// delete, so it is sequenced by the caller rather than buried in this function.
export async function deleteStory(id: string): Promise<void> {
  const { error } = await createClient().from("stories").delete().eq("id", id);
  if (error) fail("delete", error.message);
}

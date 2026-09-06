import { useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import { listStories } from "./storyRepo";
import { SavedStory } from "./stories";

// The signed-in user's saved stories, in the same useSyncExternalStore shape as the other stores
// (storyHistory.ts / useSession.ts / useLayoutMode.ts).
//
// A module-level store rather than per-component state because more than one screen reads this list
// - the Library grid and, later, Home's Continue card - and a write from anywhere (auto-save on
// create, a delete) has to move all of them at once. Two components each running their own fetch
// would drift the moment one of them wrote.

export type LibraryState = {
  stories: SavedStory[];
  // Distinguishes "no stories yet" from "haven't loaded them yet", so the Library shows a skeleton
  // instead of flashing the empty state at a user who has twenty saved stories.
  loading: boolean;
  error: string | null;
};

type Listener = () => void;
const listeners = new Set<Listener>();

const EMPTY: SavedStory[] = [];
const INITIAL: LibraryState = { stories: EMPTY, loading: true, error: null };
// Stable constant: a fresh object from getServerSnapshot causes an infinite render loop.
const SERVER_SNAPSHOT: LibraryState = INITIAL;

// Single mutable reference, replaced only on a real change - useSyncExternalStore compares by identity.
let snapshot: LibraryState = INITIAL;

function setSnapshot(next: LibraryState) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

let currentUserId: string | null = null;
let unsubscribeAuth: (() => void) | null = null;

// Guards against out-of-order fetches: sign in as A, sign out, sign in as B in quick succession and
// A's slower response must not land in B's library. Every fetch captures the generation it started
// in and discards itself if anything has moved on since.
let generation = 0;

async function load() {
  const mine = ++generation;
  const userId = currentUserId;

  if (!userId) {
    setSnapshot({ stories: EMPTY, loading: false, error: null });
    return;
  }

  setSnapshot({ stories: snapshot.stories, loading: true, error: null });
  try {
    const stories = await listStories();
    if (mine !== generation) return;
    setSnapshot({ stories, loading: false, error: null });
  } catch {
    if (mine !== generation) return;
    // The thrown message is a raw Postgres/PostgREST string - useful in the console, not to a parent.
    setSnapshot({ stories: EMPTY, loading: false, error: "We couldn't load your stories. Pull to refresh, or try again in a moment." });
  }
}

// Called after any write so every subscribed screen moves together. Fire-and-forget by design: a
// failed refresh shows the error state, it never rejects into a caller that was just saving a story.
export function refreshLibrary(): void {
  void load();
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  if (listeners.size === 1) {
    // onAuthStateChange fires an immediate INITIAL_SESSION event, so the first load is driven by
    // this rather than by a separate getSession() call - same pattern as useSession.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      // Token refreshes fire this repeatedly with an unchanged user. Reloading the whole library on
      // every one would refetch every few minutes for no reason.
      if (nextUserId === currentUserId) return;
      currentUserId = nextUserId;
      void load();
    });
    unsubscribeAuth = () => data.subscription.unsubscribe();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeAuth?.();
      unsubscribeAuth = null;
      currentUserId = null;
      // Invalidate any in-flight fetch so it can't resolve into the reset store.
      generation++;
      // Reset rather than keeping the last list: a remount must not render one user's stories to
      // whoever is signed in now, before the auth listener has re-reported. No notify() - nothing
      // is listening.
      snapshot = INITIAL;
    }
  };
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

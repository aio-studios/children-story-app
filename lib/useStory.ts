import { useEffect, useState } from "react";
import { getStory } from "./storyRepo";
import { SavedStory } from "./stories";

export type StoryState = {
  story: SavedStory | null;
  loading: boolean;
  // Separates "this story does not exist (or isn't yours)" from "the fetch failed" - the first is a
  // dead end that deserves a way back to the Library, the second is worth a retry.
  notFound: boolean;
  error: string | null;
};

const LOADING: StoryState = { story: null, loading: true, notFound: false, error: null };
const NO_ID: StoryState = { story: null, loading: false, notFound: true, error: null };

// What came back, tagged with the id it came back for.
type Resolved = { id: string; state: StoryState };

// One story, by id, for opening a saved story from the Library.
//
// Deliberately NOT a module store like useLibrary: this is per-screen state keyed by a route param,
// so two readers open at once must not overwrite each other. The list is shared; a single story is not.
export function useStory(id: string | null): StoryState {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!id) return;

    // Guards two races at once: the id changing mid-flight, and a resolve arriving after unmount.
    let active = true;

    getStory(id)
      .then((story) => {
        if (!active) return;
        setResolved({ id, state: { story, loading: false, notFound: story === null, error: null } });
      })
      .catch(() => {
        if (!active) return;
        setResolved({
          id,
          state: {
            story: null,
            loading: false,
            notFound: false,
            error: "We couldn't open that story. Try again in a moment.",
          },
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (!id) return NO_ID;
  // Derived during render rather than reset in the effect: state tagged with a different id is
  // someone else's answer, so a changed id reads as loading immediately, in the same commit. Resetting
  // it from the effect would render the previous story for one frame first - and trips the
  // react-hooks set-state-in-effect rule, which is pointing at exactly that bug.
  return resolved?.id === id ? resolved.state : LOADING;
}

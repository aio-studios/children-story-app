"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LibraryScreen } from "@/components/LibraryScreen";
import { SavedStory } from "@/lib/stories";

// The Library is a real route, not another view in /create's state machine (plan decision: two new
// routes only). It has no generation state of its own to keep, it is deep-linkable, and it is the
// screen a signed-in user will land on most often after Home.
//
// Home and Create live inside /create, so the global nav's callbacks become route pushes here. The
// story id travels as a query param rather than a /story/[id] route: that route is #56's job, and
// adding it now would mean a second reader mount point before there is anything to share.
export default function LibraryPage() {
  const router = useRouter();

  return (
    <AppShell
      activeTab="library"
      onNavigateHome={() => router.push("/create")}
      onNavigateNewStory={() => router.push("/create?new=1")}
      onNavigateLibrary={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <LibraryScreen
        onOpenStory={(story: SavedStory) => router.push(`/create?story=${encodeURIComponent(story.id)}`)}
        onCreateStory={() => router.push("/create?new=1")}
      />
    </AppShell>
  );
}

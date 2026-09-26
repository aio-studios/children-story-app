"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SettingsScreen } from "@/components/SettingsScreen";

// A real route, for the same reasons the Library is one (see app/library/page.tsx): no generation
// state to keep, deep-linkable, and reached from the global nav rather than from inside /create's
// view state machine.
export default function SettingsPage() {
  const router = useRouter();

  return (
    <AppShell
      activeTab="settings"
      onNavigateHome={() => router.push("/create")}
      onNavigateNewStory={() => router.push("/create?new=1")}
      onNavigateLibrary={() => router.push("/library")}
      onNavigateSettings={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <SettingsScreen />
    </AppShell>
  );
}

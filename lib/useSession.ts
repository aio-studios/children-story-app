import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { clearContinueStory } from "./storyHistory";

// Client-side view of "who is signed in", in the same useSyncExternalStore shape as the other stores
// (see storyHistory.ts / useLayoutMode.ts).
//
// SECURITY: this reflects the locally-stored session and is NOT revalidated against the auth server.
// It decides what the UI *shows* - never what data is reachable. Every read/write is gated by RLS in
// Postgres, and server code that needs a trustworthy identity calls supabase.auth.getUser().
export type SessionState = {
  user: User | null;
  // Distinguishes "definitely signed out" from "haven't heard back yet", so the Library can show a
  // skeleton instead of flashing the guest empty state at every signed-in user on load.
  loading: boolean;
};

type Listener = () => void;
const listeners = new Set<Listener>();

// useSyncExternalStore compares snapshots by identity, so this must be a single mutable reference
// that is replaced only on a real change - never rebuilt per call.
let snapshot: SessionState = { user: null, loading: true };

// Stable constant: returning a fresh object from getServerSnapshot causes an infinite render loop.
const SERVER_SNAPSHOT: SessionState = { user: null, loading: true };

function setSnapshot(next: SessionState) {
  if (snapshot.user?.id === next.user?.id && snapshot.loading === next.loading) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

let unsubscribeAuth: (() => void) | null = null;

function subscribe(listener: Listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    // onAuthStateChange fires an immediate INITIAL_SESSION event, so this resolves `loading` on its
    // own - no separate getSession() call needed.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setSnapshot({ user: session?.user ?? null, loading: false });
    });
    unsubscribeAuth = () => data.subscription.unsubscribe();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeAuth?.();
      unsubscribeAuth = null;
    }
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

export type MagicLinkResult = { ok: true } | { ok: false; message: string };

// Sends the sign-in email. `emailRedirectTo` is what the email template reads as {{ .RedirectTo }},
// which is why localhost and production both work without per-environment template edits - the host
// still has to be in Supabase's redirect allowlist, so this can't be pointed anywhere.
export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
  const { error } = await createClient().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error("Magic link request failed:", error.message);
    return { ok: false, message: "We couldn't send that link. Check the address and try again." };
  }
  return { ok: true };
}

// Clearing the local continue slot is shared-device hygiene: without it, signing out on the family
// iPad leaves the last story sitting on Home for the next person. In `finally` so a failed network
// sign-out still clears local state - the DB copy is the durable one for signed-in users.
export async function signOut(): Promise<void> {
  try {
    await createClient().auth.signOut();
  } finally {
    clearContinueStory();
  }
}

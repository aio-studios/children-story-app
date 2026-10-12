"use client";

import { useState } from "react";
import { signOut, useSession } from "@/lib/useSession";
import { SignInForm } from "./SignInForm";

/* Settings (#92). The nav has carried a "Soon" Settings item since Nav-2; this makes it real, and it
   exists now rather than in Step 9 for one blunt reason found in UAT: there was no way to sign out.
   `signOut()` had been sitting in lib/useSession.ts with zero callers, so the only way back to a
   signed-out app was clearing site data.

   Deliberately just the account, not a settings catalogue. Theme follows the OS and has no toggle,
   and the nav's collapsed state persists itself. Step 9 added the second card: deleting the account,
   which purges its stories and their Blob covers server-side (app/api/delete-account). */

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsScreen() {
  const { user, loading } = useSession();
  // Sign-out is a round trip. Without this the button stays live and a second tap fires a second
  // request against a session the first one is already tearing down.
  const [signingOut, setSigningOut] = useState(false);
  // Delete account: a two-step reveal, then the parent types DELETE. A toddler with the phone can
  // tap a button twice; they can't spell DELETE.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Survives the swap to the signed-out pane, so the parent sees the deletion actually happened
  // rather than just finding themselves signed out.
  const [deleted, setDeleted] = useState(false);
  // How many cover pictures the server couldn't remove even after retrying. Rare (a Blob outage), but
  // the parent was promised every picture goes, so they're told rather than shown a clean success.
  const [coversLeftBehind, setCoversLeftBehind] = useState(0);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Reset only on failure: on success the session store notifies and this swaps to the
      // signed-out pane, and clearing it first would flash the button back to "Sign out" on the way.
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting || confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error ?? "We couldn't delete your account. Please try again.");
        setDeleting(false);
        return;
      }
      const data = (await res.json().catch(() => null)) as { coversLeftBehind?: number } | null;
      setCoversLeftBehind(data?.coversLeftBehind ?? 0);
      setDeleted(true);
      // The server already cleared the session cookies. This drops the browser's copy of the session
      // and this device's local story slot, and the session store swaps the screen to signed-out.
      await signOut().catch(() => {});
    } catch {
      setDeleteError("We couldn't reach the server. Check your connection and try again.");
      setDeleting(false);
    }
  }

  return (
    <main className="sk-set">
      <h1 className="sk-set-title">Settings</h1>

      <section className="sk-set-card" aria-labelledby="sk-set-account-h">
        <div className="sk-set-card-head">
          <span className="sk-set-card-ico" aria-hidden="true">
            <AccountIcon />
          </span>
          <h2 className="sk-set-card-h" id="sk-set-account-h">
            Account
          </h2>
        </div>

        {/* Same ordering rule as the Library: resolve the session before showing anything, so a
            signed-in user never sees the sign-in pitch flash before their own email. */}
        {loading ? (
          <div className="sk-set-skeleton" aria-busy="true" aria-label="Checking your account" />
        ) : user ? (
          <>
            <p className="sk-set-row">
              <span className="sk-set-row-label">Signed in as</span>
              <span className="sk-set-row-value">{user.email}</span>
            </p>
            <p className="sk-set-b">Your stories follow you to any phone, tablet or computer.</p>
            <button type="button" className="sk-set-signout" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
            <p className="sk-set-note">
              Signing out leaves your stories safe in your library. Sign back in any time to read them
              again.
            </p>
          </>
        ) : (
          <>
            {deleted && (
              <p className="sk-set-done" role="status">
                Your account and all its stories have been deleted.
                {coversLeftBehind > 0 &&
                  ` ${coversLeftBehind === 1 ? "One cover picture" : `${coversLeftBehind} cover pictures`} couldn't be removed right away. We've logged ${coversLeftBehind === 1 ? "it" : "them"} and will remove ${coversLeftBehind === 1 ? "it" : "them"} by hand.`}
              </p>
            )}
            <p className="sk-set-b">
              You&apos;re not signed in, so stories are saved on this device only. Add your email and
              they follow you anywhere.
            </p>
            <SignInForm className="sk-set-form" />
            <p className="sk-set-note">
              No password, no app to install. We email you a link and that&apos;s the whole sign-in.
            </p>
          </>
        )}
      </section>

      {user && !loading && (
        <section className="sk-set-card" aria-labelledby="sk-set-delete-h">
          <h2 className="sk-set-card-h" id="sk-set-delete-h">
            Delete account
          </h2>
          <p className="sk-set-b">
            Deletes your account, every story in your library, and their cover pictures. This can&apos;t
            be undone.
          </p>
          {!deleteOpen ? (
            <button type="button" className="sk-set-danger" onClick={() => setDeleteOpen(true)}>
              Delete my account
            </button>
          ) : (
            <>
              <label className="sk-set-confirm">
                {/* One span: the label is a flex column, so bare text + <strong> would stack as three rows. */}
                <span>
                  Type <strong>DELETE</strong> to confirm
                </span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="sk-field font-normal"
                  disabled={deleting}
                />
              </label>
              {deleteError && (
                <p className="sk-set-error" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="sk-set-actions">
                <button
                  type="button"
                  className="sk-set-danger sk-set-danger-solid"
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmText !== "DELETE"}
                >
                  {deleting ? "Deleting…" : "Delete forever"}
                </button>
                <button
                  type="button"
                  className="sk-set-signout"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <p className="sk-set-legal">
        <a href="/privacy">Privacy: what we store and how to delete it</a>
      </p>
    </main>
  );
}

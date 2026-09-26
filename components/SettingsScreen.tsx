"use client";

import { useState } from "react";
import { signOut, useSession } from "@/lib/useSession";
import { SignInForm } from "./SignInForm";

/* Settings (#92). The nav has carried a "Soon" Settings item since Nav-2; this makes it real, and it
   exists now rather than in Step 9 for one blunt reason found in UAT: there was no way to sign out.
   `signOut()` had been sitting in lib/useSession.ts with zero callers, so the only way back to a
   signed-out app was clearing site data.

   Deliberately just the account, not a settings catalogue. Theme follows the OS and has no toggle,
   the nav's collapsed state persists itself, and "delete my account" is Step 9's job because it has
   to purge Blob covers too - promising it here before it works would be worse than its absence. */

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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Not reset on success: the session store notifies, this unmounts to the signed-out pane, and
      // clearing it first would flash the button back to "Sign out" on the way there.
      setSigningOut(false);
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
    </main>
  );
}

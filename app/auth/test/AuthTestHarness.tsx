"use client";

import { useState } from "react";
import { useSession, sendMagicLink, signOut } from "@/lib/useSession";

// TEMPORARY SCAFFOLDING (#92, Step 3). Exists only to exercise the real magic-link flow on a real
// device before the persistence layer exists. Deliberately unstyled-ish: the actual sign-in UI is
// the end-of-story sheet in Step 7 (design: docs/designs/library-accounts-directions.html, frame A2)
// and this page must be deleted then, not evolved into it.
//
// Reachability is gated in page.tsx (server-side) rather than here - a client-side check would still
// ship this component to production and only hide it visually.

type SendState = { status: "idle" | "sending" | "sent" } | { status: "error"; message: string };

export default function AuthTestHarness() {
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [send, setSend] = useState<SendState>({ status: "idle" });

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setSend({ status: "sending" });
    const result = await sendMagicLink(email.trim());
    setSend(result.ok ? { status: "sent" } : { status: "error", message: result.message });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Auth test harness</h1>
        <p className="mt-1 text-sm opacity-70">Temporary — removed in Step 7.</p>
      </div>

      <div className="rounded-xl border border-current/15 p-4 text-sm">
        <div className="font-semibold">Session</div>
        {loading ? (
          <p className="mt-1 opacity-70">Checking…</p>
        ) : user ? (
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="inline opacity-70">email: </dt>
              <dd className="inline break-all">{user.email}</dd>
            </div>
            <div>
              {/* Shown so the two-user RLS check can confirm the id actually differs between accounts. */}
              <dt className="inline opacity-70">user id: </dt>
              <dd className="inline break-all font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 opacity-70">Signed out (guest)</p>
        )}
      </div>

      {user ? (
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-xl border border-current/20 px-4 py-3 font-semibold"
        >
          Sign out
        </button>
      ) : (
        <form onSubmit={handleSend} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="rounded-xl border border-current/20 bg-transparent px-4 py-3"
          />
          <button
            type="submit"
            disabled={send.status === "sending"}
            className="rounded-xl border border-current/20 px-4 py-3 font-semibold disabled:opacity-50"
          >
            {send.status === "sending" ? "Sending…" : "Send me a link"}
          </button>
          {send.status === "sent" && (
            <p className="text-sm opacity-70">
              Check your email. The link opens <code>/auth/callback</code>; a failure comes back to{" "}
              <code>/?auth=failed</code>.
            </p>
          )}
          {send.status === "error" && <p className="text-sm font-medium">{send.message}</p>}
        </form>
      )}
    </main>
  );
}

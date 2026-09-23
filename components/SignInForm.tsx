"use client";

import { useEffect, useState } from "react";
import { sendMagicLink } from "@/lib/useSession";

// The magic-link ask, as one reusable block: email field → "Send me a link" → "check your email",
// with a resend cooldown. Lives in its own component because it is needed in two places that are
// otherwise nothing alike - the Library's guest empty state (#92 Step 6) and the end-of-story sheet
// (Step 7). Two copies would drift the moment one of them fixed a cooldown or a validation message.

// How long before "Send again" comes back. Long enough that a double-tap can't spend two of Brevo's
// 300 daily emails, short enough that someone who genuinely didn't get the mail isn't stuck.
const RESEND_COOLDOWN_S = 45;

// Deliberately loose: the real check is whether the email arrives. A strict regex only ever rejects
// addresses that are actually valid (+ tags, new TLDs, unicode locals) - the failure mode we can't
// recover from, since there is no other way in.
function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

type Props = {
  /** Where the caller wants the copy to sit: the Library's inline block or Step 7's sheet. */
  className?: string;
  /** Autofocus the field. Off by default - correct for an inline block, wrong for a sheet that just
   *  slid up over a story a child is looking at. */
  autoFocus?: boolean;
  /** Fired once the link is actually away. The end-of-story sheet uses it to relabel its dismiss
   *  button from "Not now" to "Close" - and to stop treating that tap as a refusal worth snoozing,
   *  since someone waiting on a link is mid-sign-in, not declining. */
  onSent?: () => void;
};

export function SignInForm({ className, autoFocus = false, onSent }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // The address the link actually went to, not whatever is in the field now - the confirmation has to
  // name what we sent to, so a typo is visible before someone sits waiting for mail that can't arrive.
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending" || cooldown > 0) return;

    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setError("That doesn't look like an email address.");
      return;
    }

    setError(null);
    setStatus("sending");
    const result = await sendMagicLink(trimmed);
    if (result.ok) {
      setSentTo(trimmed);
      setStatus("sent");
      setCooldown(RESEND_COOLDOWN_S);
      onSent?.();
      return;
    }
    // Back to the form with the address still in it - retyping an email to retry is a small
    // indignity that costs us the sign-up.
    setStatus("idle");
    setError(result.message);
  }

  if (status === "sent") {
    return (
      <div className={`sk-signin ${className ?? ""}`}>
        <p className="sk-signin-sent" role="status">
          <strong>Check your email.</strong> We sent a link to <span className="sk-signin-addr">{sentTo}</span>.
          Tap it and you&apos;re in - no password to remember.
        </p>
        <button
          type="button"
          className="sk-nav-btn"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
        </button>
      </div>
    );
  }

  return (
    <form className={`sk-signin ${className ?? ""}`} onSubmit={handleSubmit} noValidate>
      <label className="sk-form-label" htmlFor="sk-signin-email">
        Email
      </label>
      <input
        id="sk-signin-email"
        className="sk-field font-normal"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        autoFocus={autoFocus}
        onChange={(event) => {
          setEmail(event.target.value);
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "sk-signin-error" : undefined}
      />
      {error && (
        <p className="sk-signin-error" id="sk-signin-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="sk-nav-btn sk-nav-btn-primary sk-signin-go" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send me a link"}
      </button>
    </form>
  );
}

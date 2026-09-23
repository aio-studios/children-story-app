"use client";

import { useEffect, useRef, useState } from "react";
import { SignInForm } from "./SignInForm";

// The ask, at the one moment the answer is yes (#92, Step 7 - design frame A2). A guest who has just
// finished a story is the only person who has both seen what the app is worth and got something
// worth keeping. Wraps the shared SignInForm rather than growing a second one, so the cooldown and
// the validation message can only ever be fixed in one place.

type SaveStorySheetProps = {
  /** "Not now", Escape, or a tap on the scrim. The caller decides what that costs (a snooze). */
  onDismiss: () => void;
  /** Dismissed after the link is already sent - the same close, but not a refusal. */
  onClose: () => void;
};

export function SaveStorySheet({ onDismiss, onClose }: SaveStorySheetProps) {
  // Once the link is away, "Not now" is the wrong label and the wrong meaning: this person is
  // mid-sign-in, waiting on an email, not declining. Relabel, and don't snooze on the way out.
  const [sent, setSent] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const focusBeforeRef = useRef<HTMLElement | null>(null);

  // One exit, three ways to reach it: the button, Escape, and the scrim. They must agree, or
  // tapping outside the sheet would quietly cost a week of asks that "Not now" charges honestly.
  const dismiss = sent ? onClose : onDismiss;

  // Matches the Library's delete dialog: Escape closes, and the listener re-binds when the handler
  // it calls changes, rather than holding the first render's closure forever.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dismiss]);

  // Focus the sheet itself, not the email field: this slid up over a story a child may still be
  // looking at, and yanking up the keyboard is the wrong first move. Restored on close so the reader
  // gets the keyboard back where it was.
  useEffect(() => {
    focusBeforeRef.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    return () => focusBeforeRef.current?.focus?.();
  }, []);

  // Stop the story scrolling behind the scrim. `overflow: hidden` rather than `position: fixed` on
  // purpose - the latter resets scrollY, and the reader computes its saved reading position from it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="sk-sheet-scrim" role="presentation" onClick={dismiss}>
      <div
        className="sk-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sk-sheet-title"
        tabIndex={-1}
        ref={sheetRef}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sk-sheet-grab" aria-hidden="true" />
        <h2 className="sk-sheet-title" id="sk-sheet-title">
          Keep this story?
        </h2>
        <p className="sk-sheet-body">
          Right now it only lives on this phone, until you make the next one. Add your email and it will
          be waiting on any device.
        </p>
        <SignInForm className="sk-sheet-form" onSent={() => setSent(true)} />
        <button type="button" className="sk-nav-btn sk-sheet-dismiss" onClick={dismiss}>
          {sent ? "Close" : "Not now"}
        </button>
        {!sent && <p className="sk-sheet-fine">No password. We email a link that signs you in.</p>}
      </div>
    </div>
  );
}

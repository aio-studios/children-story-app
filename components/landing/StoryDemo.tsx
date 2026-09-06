"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The landing page's one client island (#97). Everything else on `/` is a static server component,
   so this is the only JS a cold visitor downloads.

   It is a *scripted* demo, not a live generation: it makes no API call. That's deliberate - the
   hero must render identically for every visitor, cost nothing per view, and stay up when the
   Anthropic API doesn't (see #99, which took story generation down entirely). The copy below is a
   real Storykins output shape, not invented marketing prose. */

const PICKS = ["Fantasy", "Luna the Apprentice Witch", "Kindness"] as const;

const STATUS_BY_PICK = [
  "Choosing a world…",
  "Picking a hero…",
  "Setting the lesson…",
] as const;

const STORY =
  "Luna's broomstick had exactly one rule, and Luna had already broken it twice before breakfast. " +
  "“Slowly,” she whispered, gripping the handle with both hands. The broom, who had opinions, " +
  "went sideways instead — straight over Mrs Pemberly's washing line.";

/* Kept short on purpose: the pick sequence is pre-roll, and until typing starts the stage is an empty
   box. At 620ms/pick that was ~2.5s of blank panel as the first thing a cold visitor saw. */
const PICK_INTERVAL_MS = 400;
const TYPING_LEAD_IN_MS = 220;
const TYPE_INTERVAL_MS = 18;
const DONE_STATUS = "Done · illustrating the cover…";

export function StoryDemo() {
  // How many of PICKS are lit: 0 = none yet, up to PICKS.length.
  const [picksLit, setPicksLit] = useState(0);
  const [typed, setTyped] = useState(0);
  const [status, setStatus] = useState<string>(STATUS_BY_PICK[0]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  // A ref, not state: this only guards against re-running and must never itself cause a render.
  const startedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  // Renders the finished state immediately - used for reduced-motion, so the hero still communicates
  // what the product does without any animation at all.
  const settle = useCallback(() => {
    clearTimers();
    setPicksLit(PICKS.length);
    setTyped(STORY.length);
    setStatus(DONE_STATUS);
  }, [clearTimers]);

  const run = useCallback(() => {
    clearTimers();
    setPicksLit(0);
    setTyped(0);
    setStatus(STATUS_BY_PICK[0]);

    PICKS.forEach((_, i) => {
      later(() => {
        setPicksLit(i + 1);
        setStatus(STATUS_BY_PICK[i + 1] ?? "Writing…");
      }, PICK_INTERVAL_MS * (i + 1));
    });

    const typingStartsAt = PICK_INTERVAL_MS * PICKS.length + TYPING_LEAD_IN_MS;
    for (let i = 1; i <= STORY.length; i++) {
      later(() => {
        setTyped(i);
        if (i === STORY.length) setStatus(DONE_STATUS);
      }, typingStartsAt + TYPE_INTERVAL_MS * i);
    }
  }, [clearTimers, later]);

  // Start when the demo actually scrolls into view, so a visitor who lands mid-page doesn't arrive
  // after it has already finished playing to an empty room.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    /* Every state update happens inside the observer callback, never in this effect body - a
       synchronous setState here triggers cascading renders (react-hooks/set-state-in-effect).
       The reduced-motion branch lives in the callback for the same reason; a reduced-motion visitor
       gets the finished story the moment the demo scrolls into view, with no typing. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (startedRef.current || !entries.some((e) => e.isIntersecting)) return;
        startedRef.current = true;
        observer.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          settle();
        } else {
          run();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [run, settle]);

  useEffect(() => clearTimers, [clearTimers]);

  const isDone = typed >= STORY.length;

  const handleReplay = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }
    run();
  };

  return (
    <div className="sk-lp-demo" ref={rootRef}>
      <div className="sk-lp-demo-picks">
        {PICKS.map((pick, i) => (
          <span
            key={pick}
            className={`sk-lp-demo-pick ${i < picksLit ? "is-on" : ""}`}
          >
            {pick}
          </span>
        ))}
      </div>

      <div className="sk-lp-demo-stage">
        {/* The visible paragraph mutates once per character. A live region here would re-announce the
            whole story on every keystroke - hundreds of times - so the typing effect is hidden from
            assistive tech entirely, and the finished text is announced exactly once by the live
            region below. */}
        <p className="sk-lp-demo-text" aria-hidden="true">
          {isDone ? STORY : STORY.slice(0, typed)}
          {!isDone && <span className="sk-lp-demo-caret" aria-hidden="true" />}
        </p>
        <p className="sr-only" aria-live="polite">
          {isDone ? STORY : ""}
        </p>
      </div>

      <div className="sk-lp-demo-foot">
        <span className="sk-lp-demo-status">
          <span
            className={`sk-lp-demo-pulse ${isDone ? "is-done" : ""}`}
            aria-hidden="true"
          />
          {status}
        </span>
        <button type="button" className="sk-lp-demo-replay" onClick={handleReplay}>
          Replay
        </button>
      </div>
    </div>
  );
}

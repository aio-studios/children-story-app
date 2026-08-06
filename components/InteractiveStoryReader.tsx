"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { fredoka, nunito } from "@/lib/fonts";
import { InteractiveStory, StepAction } from "@/lib/interactive";
import { GenreSelection } from "@/lib/types";
import { CoverStatus, genreDisplay, StoryCover } from "./StoryReader";

// Rotating flavor while a beat generates, so a slow wait feels alive instead of a static spinner.
const STEP_MESSAGES = [
  "Dreaming up what happens next…",
  "Turning the page…",
  "Sprinkling in a little magic…",
  "Following your lead…",
  "Peeking around the next corner…",
];
const STEP_MESSAGE_INTERVAL_MS = 2200;

type InteractiveStoryReaderProps = {
  genreSelection: GenreSelection;
  story: InteractiveStory;
  coverStatus: CoverStatus;
  coverUrl: string | null;
  isStepping: boolean;
  stepError: string | null;
  onAdvance: (action: StepAction) => void;
  onRetry: () => void;
  onGoBack: () => void;
  onBackToSetup: () => void;
};

export function InteractiveStoryReader({
  genreSelection,
  story,
  coverStatus,
  coverUrl,
  isStepping,
  stepError,
  onAdvance,
  onRetry,
  onGoBack,
  onBackToSetup,
}: InteractiveStoryReaderProps) {
  const { icon, label, accent } = genreDisplay(genreSelection);
  const accentVars = { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;

  const [panelOpen, setPanelOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageTick, setMessageTick] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Cycle the loading message only while a beat is in flight. setState runs in the interval callback,
  // not synchronously in the effect body, so it doesn't trigger cascading renders.
  useEffect(() => {
    if (!isStepping) return;
    const id = setInterval(() => setMessageTick((tick) => tick + 1), STEP_MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isStepping]);
  const stepMessage = STEP_MESSAGES[messageTick % STEP_MESSAGES.length];

  const beatCount = story.beats.length;
  const progressPct = story.ended ? 100 : Math.round((beatCount / story.arc.max) * 100);

  // Bring the newest beat into view whenever one is appended (DOM-only side effect). Skipped on the
  // opening beat so the reader starts at the cover/title, not scrolled past them.
  useEffect(() => {
    if (beatCount > 1) endRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [beatCount, story.ended]);

  // Advancing collapses the steering panel and clears any draft, so the reader returns to the
  // low-friction ▶ state for the next beat. Reset happens on the action, not in an effect.
  function advance(action: StepAction) {
    setPanelOpen(false);
    setWriting(false);
    setDraft("");
    onAdvance(action);
  }

  function submitWriting() {
    const text = draft.trim();
    if (text.length === 0) return;
    advance({ kind: "freeText", text });
  }

  return (
    <main className={`story-reader-canvas ir-canvas ${fredoka.variable} ${nunito.variable}`}>
      <div className="story-reader-frame ir-frame" style={accentVars}>
        <div className="story-reader-glow" aria-hidden="true" />
        <article className="story-reader-page">
          <span className="story-reader-badge">
            <span className="story-reader-badge-icon">{icon}</span>
            <span className="story-reader-badge-label">{label}</span>
          </span>
          <StoryCover status={coverStatus} url={coverUrl} icon={icon} />
          <h1 className="story-reader-title">{story.title}</h1>
          <div className="story-reader-flourish" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <div className="story-reader-story">
            {story.beats.map((beat, index) => (
              <p key={index} className={index === beatCount - 1 ? "ir-fresh" : undefined}>
                {beat}
              </p>
            ))}
          </div>
          <div ref={endRef} aria-hidden="true" />
        </article>
      </div>

      <div className="ir-dock" style={accentVars}>
        <div className="ir-progress" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Story progress">
          <i style={{ width: `${progressPct}%` }} />
        </div>

        {story.ended ? (
          <div className="ir-end">
            <div className="ir-end-stars" aria-hidden="true">✦ ✦ ✦</div>
            <div className="ir-end-title">The End</div>
            <button type="button" className="ir-secondary-btn" onClick={onBackToSetup}>
              ← Make another story
            </button>
          </div>
        ) : isStepping ? (
          <div className="ir-stepping">
            <span className="ir-stepping-wand" aria-hidden="true">🪄</span>
            <span key={stepMessage} className="ir-stepping-msg">{stepMessage}</span>
          </div>
        ) : stepError ? (
          <div className="ir-error">
            <p>{stepError}</p>
            <button type="button" className="ir-continue" onClick={onRetry}>
              ↻ Try again
            </button>
          </div>
        ) : (
          <>
            <div className="ir-dock-row">
              <button type="button" className="ir-continue" onClick={() => advance({ kind: "continue" })}>
                <svg className="ir-continue-icon" viewBox="0 0 10 12" width="11" height="12" aria-hidden="true">
                  <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
                </svg>
                Continue
              </button>
              <button
                type="button"
                className="ir-choose-toggle"
                aria-expanded={panelOpen}
                onClick={() => setPanelOpen((open) => !open)}
              >
                Choose {panelOpen ? "▴" : "▾"}
              </button>
            </div>

            {panelOpen && (
              <div className="ir-panel">
                {story.choices.length > 0 && (
                  <>
                    <div className="ir-choice-lead">Or steer the story</div>
                    <div className="ir-choices">
                      {story.choices.map((choice, index) => (
                        <button
                          key={index}
                          type="button"
                          className="ir-choice"
                          onClick={() => advance({ kind: "choice", text: choice })}
                        >
                          <span className="ir-choice-dot" aria-hidden="true" />
                          <span>{choice}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {writing ? (
                  <div className="ir-writer">
                    <input
                      type="text"
                      value={draft}
                      maxLength={300}
                      autoFocus
                      placeholder="…and then?"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitWriting();
                      }}
                    />
                    <button type="button" onClick={submitWriting}>Go</button>
                  </div>
                ) : (
                  <button type="button" className="ir-choice ir-choice-own" onClick={() => setWriting(true)}>
                    ✎ Write your own…
                  </button>
                )}
              </div>
            )}

            {/* Only offer "go back" once past the opening beat - the opening was auto-generated on
                entry, not a step the reader chose to take. Drops the last beat and restores the
                previous decision so they can pick a different direction. */}
            {beatCount > 1 && (
              <button type="button" className="ir-redo" onClick={onGoBack}>
                ← Go back a step
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

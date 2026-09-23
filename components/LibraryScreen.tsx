"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { CUSTOM_GENRE_ACCENT, getGenreAccent, getGenreById } from "@/lib/genres";
import {
  clearContinueStoryForRow,
  getContinueGenre,
  getContinueProgress,
  getContinueTitle,
  isContinueComplete,
} from "@/lib/storyHistory";
import { SavedStory } from "@/lib/stories";
import { LIBRARY_LIMIT, deleteStory } from "@/lib/storyRepo";
import { refreshLibrary, useLibrary } from "@/lib/useLibrary";
import { useSession } from "@/lib/useSession";
import { SignInForm } from "./SignInForm";

// The Library (#92 Step 6) - approved design docs/designs/library-accounts-directions.html, Direction
// A frame A1: the library is its own destination, laid out as a cover grid, with History and
// Favourites as tabs inside it rather than two seats in the global nav.
//
// Favourites is a labelled shell on purpose. It ships for real with #55; showing the tab now is what
// makes the 20-story cap feel survivable ("there will be a way to keep one"), and hiding it would
// mean re-teaching the screen later.

type LibraryScreenProps = {
  /** Opens a saved story by id. The route owns where that goes; this screen just names the story. */
  onOpenStory: (story: SavedStory) => void;
  onCreateStory: () => void;
};

type Tab = "history" | "favourites";

// Where the capacity meter stops being a neutral count and starts being a warning. Three left is
// enough notice to do something about it (finish one, delete one) before a story actually rolls off.
const CAPACITY_WARN_AT = LIBRARY_LIMIT - 3;

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true">
      <path
        d="M12 20.3C8 17 4 14 4 9.6 4 7.1 6 5.2 8.4 5.2c1.6 0 2.9.9 3.6 2.1.7-1.2 2-2.1 3.6-2.1C18 5.2 20 7.1 20 9.6c0 4.4-4 7.4-8 10.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShelfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h11v18H6a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 7h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Coarse on purpose: nobody needs "3 hours and 12 minutes ago" for a bedtime story, and coarse
// buckets stay correct for far longer without a re-render.
function relativeTime(epochMs: number): string {
  const days = Math.floor((Date.now() - epochMs) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function genreLabel(story: SavedStory): string {
  const genre = getContinueGenre(story);
  return genre.type === "custom" ? genre.text : (getGenreById(genre.genreId)?.label ?? "Story");
}

function accentStyle(story: SavedStory): CSSProperties {
  const genre = getContinueGenre(story);
  const accent = genre.type === "custom" ? CUSTOM_GENRE_ACCENT : getGenreAccent(genre.genreId);
  return { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;
}

function StoryCard({
  story,
  onOpen,
  onRequestDelete,
}: {
  story: SavedStory;
  onOpen: () => void;
  onRequestDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on an outside tap or Escape. Pointerdown rather than click so it closes on the same
  // gesture that opens another card's menu, instead of needing two taps.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!cardRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const progress = getContinueProgress(story);
  const complete = isContinueComplete(story);
  const percent = Math.round(progress * 100);
  const showCover = Boolean(story.imageUrl) && !artFailed;

  return (
    // A div, not a button: the ⋯ menu is itself a button and buttons cannot nest. The open action is
    // its own full-bleed button underneath instead.
    <div className="sk-lib-card" style={accentStyle(story)} ref={cardRef}>
      <button type="button" className="sk-lib-open" onClick={onOpen}>
        <span className="sk-lib-cover">
          <span className="sk-lib-art" aria-hidden="true" />
          {showCover && (
            // eslint-disable-next-line @next/next/no-img-element -- remote Vercel Blob cover, not run through the next/image optimizer (same as the reader).
            <img src={story.imageUrl} alt="" className="sk-lib-art-img" loading="lazy" onError={() => setArtFailed(true)} />
          )}
          <span className="sk-lib-scrim" aria-hidden="true" />
          {(complete || percent > 0) && (
            <span className={`sk-lib-progress${complete ? " sk-lib-progress-done" : ""}`}>
              {complete ? "Finished" : `${percent}%`}
            </span>
          )}
        </span>
        <span className="sk-lib-meta">
          <span className="sk-lib-title">{getContinueTitle(story)}</span>
          <span className="sk-lib-sub">
            {genreLabel(story)} · {relativeTime(story.createdAt)}
          </span>
        </span>
      </button>

      <button
        type="button"
        className="sk-lib-dots"
        aria-label={`More options for ${getContinueTitle(story)}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {menuOpen && (
        <div className="sk-lib-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="sk-lib-menu-item sk-lib-menu-danger"
            onClick={() => {
              setMenuOpen(false);
              onRequestDelete();
            }}
          >
            Delete story
          </button>
        </div>
      )}
    </div>
  );
}

export function LibraryScreen({ onOpenStory, onCreateStory }: LibraryScreenProps) {
  const { user, loading: sessionLoading } = useSession();
  const { stories, loading: libraryLoading, error } = useLibrary();
  const [tab, setTab] = useState<Tab>("history");
  const [pendingDelete, setPendingDelete] = useState<SavedStory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus when the dialog opened - the ⋯ button of the card in question - so closing
  // puts the keyboard back where it was rather than at the top of the document.
  const focusBeforeModalRef = useRef<HTMLElement | null>(null);

  // Escape closes the confirmation, matching the ⋯ menu above it. Not while a delete is in flight:
  // dismissing then would leave the request running with nothing on screen to report its result.
  useEffect(() => {
    if (!pendingDelete) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) setPendingDelete(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [pendingDelete, deleting]);

  // Focus lands on "Keep it", not "Delete" - the destructive button should never be one stray Enter
  // away for someone navigating by keyboard.
  useEffect(() => {
    if (!pendingDelete) return;
    focusBeforeModalRef.current = document.activeElement as HTMLElement | null;
    keepButtonRef.current?.focus();
    return () => focusBeforeModalRef.current?.focus?.();
  }, [pendingDelete]);

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStory(pendingDelete.id);
      // A deleted story must not keep offering itself on Home's Continue card. Scoped to this row, so
      // deleting one story never clears the card for a different one still in the library.
      clearContinueStoryForRow(pendingDelete.id);
      setPendingDelete(null);
      refreshLibrary();
    } catch {
      // Already logged by the repo. Keep the dialog open with the story still in it - silently
      // closing on failure would read as "deleted" while the story is still there.
      setDeleteError("We couldn't delete that story. Try again in a moment.");
    } finally {
      setDeleting(false);
    }
  }

  const count = stories.length;
  const nearCapacity = count >= CAPACITY_WARN_AT;

  return (
    <div className="sk-lib">
      <div className="sk-lib-head">
        <h1 className="sk-lib-h1">Your library</h1>
      </div>

      {/* B's honesty, A's structure (#92, Step 7). The design compared a permanent guest banner on
          Home against saying nothing; this is the compromise the design doc landed on - one plain
          line of status, inside the screen where someone is already thinking about their stories,
          and nowhere else. It stays up while the guest pane's longer pitch scrolls away, and it is
          the only standing reminder once the end-of-story sheet has been snoozed. */}
      {!sessionLoading && !user && (
        <p className="sk-lib-local" role="status">
          <span className="sk-lib-local-dot" aria-hidden="true" />
          Saved on this phone only
        </p>
      )}

      <div className="sk-lib-seg" role="tablist" aria-label="Library sections">
        <button
          type="button"
          role="tab"
          id="sk-lib-tab-history"
          aria-selected={tab === "history"}
          aria-controls="sk-lib-pane-history"
          className={`sk-lib-seg-btn${tab === "history" ? " sk-lib-seg-on" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          type="button"
          role="tab"
          id="sk-lib-tab-favourites"
          aria-selected={tab === "favourites"}
          aria-controls="sk-lib-pane-favourites"
          className={`sk-lib-seg-btn${tab === "favourites" ? " sk-lib-seg-on" : ""}`}
          onClick={() => setTab("favourites")}
        >
          Favourites
        </button>
      </div>

      {tab === "favourites" ? (
        <div className="sk-lib-pane" role="tabpanel" id="sk-lib-pane-favourites" aria-labelledby="sk-lib-tab-favourites">
          <div className="sk-lib-empty">
            <span className="sk-lib-empty-ico" aria-hidden="true">
              <HeartIcon />
            </span>
            <span className="sk-lib-empty-a">No favourites yet</span>
            <span className="sk-lib-empty-b">
              Tap the heart on any story to keep it here, safe from the {LIBRARY_LIMIT}-story limit.
            </span>
            <span className="sk-lib-soon">Coming soon</span>
          </div>
        </div>
      ) : (
        <div className="sk-lib-pane" role="tabpanel" id="sk-lib-pane-history" aria-labelledby="sk-lib-tab-history">
          {/* Session state resolves first: showing a guest the sign-in pitch and then swapping it for
              their own stories a beat later is worse than a moment of nothing. */}
          {sessionLoading || (user && libraryLoading && count === 0) ? (
            <div className="sk-lib-grid" aria-busy="true">
              {[0, 1, 2, 3].map((key) => (
                <div className="sk-lib-skeleton" key={key} aria-hidden="true" />
              ))}
            </div>
          ) : !user ? (
            <div className="sk-lib-guest">
              <span className="sk-lib-empty-ico" aria-hidden="true">
                <ShelfIcon />
              </span>
              <h2 className="sk-lib-guest-h">Keep your stories</h2>
              <p className="sk-lib-guest-b">
                Right now a story lives on this device until you make the next one. Add your email and your last{" "}
                {LIBRARY_LIMIT} stories follow you to any phone, tablet or computer - to finish, re-read, or read
                again at bedtime.
              </p>
              <SignInForm className="sk-lib-guest-form" />
              <p className="sk-lib-guest-note">
                No password, no app to install. We email you a link and that&apos;s the whole sign-in.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="sk-lib-error" role="alert">
                  <span>{error}</span>
                  <button type="button" className="sk-nav-btn sk-lib-retry" onClick={() => refreshLibrary()}>
                    Try again
                  </button>
                </div>
              )}

              {count > 0 && (
                <div className="sk-lib-cap">
                  <div className="sk-lib-cap-row">
                    <span>
                      {count} of {LIBRARY_LIMIT} saved
                    </span>
                    {nearCapacity && <span className="sk-lib-cap-warn">Oldest rolls off soon</span>}
                  </div>
                  <div className="sk-lib-cap-bar">
                    <span
                      className={`sk-lib-cap-fill${nearCapacity ? " sk-lib-cap-fill-warn" : ""}`}
                      style={{ width: `${Math.min(100, (count / LIBRARY_LIMIT) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {count === 0 && !error ? (
                <div className="sk-lib-empty">
                  <span className="sk-lib-empty-ico" aria-hidden="true">
                    <ShelfIcon />
                  </span>
                  <span className="sk-lib-empty-a">Nothing saved yet</span>
                  <span className="sk-lib-empty-b">
                    Every story you make from now on lands here automatically - the last {LIBRARY_LIMIT} of them.
                  </span>
                  <button type="button" className="sk-nav-btn sk-nav-btn-primary" onClick={onCreateStory}>
                    Make your first story
                  </button>
                </div>
              ) : (
                <div className="sk-lib-grid">
                  {stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onOpen={() => onOpenStory(story)}
                      onRequestDelete={() => {
                        setDeleteError(null);
                        setPendingDelete(story);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {pendingDelete && (
        <div className="sk-lib-modal-scrim" role="presentation" onClick={() => !deleting && setPendingDelete(null)}>
          <div
            className="sk-lib-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sk-lib-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sk-lib-modal-title" id="sk-lib-modal-title">
              Delete “{getContinueTitle(pendingDelete)}”?
            </h2>
            <p className="sk-lib-modal-body">
              This removes the story and its picture for good. It can&apos;t be undone, and the same story
              won&apos;t come back if you make another one.
            </p>
            {deleteError && (
              <p className="sk-lib-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="sk-lib-modal-actions">
              <button
                type="button"
                className="sk-nav-btn"
                ref={keepButtonRef}
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Keep it
              </button>
              <button type="button" className="sk-nav-btn sk-lib-danger-btn" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

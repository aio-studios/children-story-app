"use client";

import { CSSProperties, useEffect, useRef } from "react";
import { fredoka, nunito } from "@/lib/fonts";
import { CUSTOM_GENRE_ACCENT, getGenreById } from "@/lib/genres";
import { saveProgress } from "@/lib/storyHistory";
import { GenreAccent, GenreSelection } from "@/lib/types";

// Throttle window-scroll writes so a fast flick saves ~2x/sec, not once per scroll event.
const PROGRESS_THROTTLE_MS = 500;
// Re-apply the restore once more after this delay so a late layout shift (cover image loading, fonts)
// doesn't leave the reader a bit off the saved spot. Kept short so it can't fight a real user scroll.
const RESTORE_SETTLE_MS = 300;
// Periodic save so reading time keeps accumulating even when the reader sits still (short story, no
// scrolling) - completion is time-gated, so time must advance without a scroll event to trigger it.
const TICK_MS = 15_000;

// Reading-progress plumbing for the classic reader (#61, D3):
//  - RESTORE: on resume, scroll back to where the reader left off (initialProgress, 0-1). The story
//    scrolls the window, so target = fraction * scrollable-height. Fraction-based so it survives the
//    cover/late-layout reflow; re-applied once after RESTORE_SETTLE_MS. 0 (fresh story) = open at top.
//  - PERSIST: last scroll position + cumulative ACTIVE reading time (paused while the tab is hidden)
//    are written on scroll (throttled), on a periodic tick, on tab-hide, and on unmount, so both the
//    "% read" and the time-gated completion stay current however the reader is left.
function useReaderProgress(initialProgress: number, initialTimeSpent: number) {
  const targetRef = useRef(initialProgress);
  const baseTimeRef = useRef(initialTimeSpent);
  useEffect(() => {
    function computeDenom(): number {
      return document.documentElement.scrollHeight - window.innerHeight;
    }
    function computeFraction(): number {
      const denom = computeDenom();
      // A story shorter than the viewport can't scroll - it's fully visible, so it counts as read.
      return denom > 0 ? Math.max(0, Math.min(1, window.scrollY / denom)) : 1;
    }

    // Active-time accounting: only count time while the tab is visible (don't credit a backgrounded
    // reader). accumulated = closed segments; activeStart = current open segment's start (null=paused).
    let accumulated = 0;
    let activeStart: number | null = document.hidden ? null : Date.now();
    function totalTimeMs(): number {
      return baseTimeRef.current + accumulated + (activeStart != null ? Date.now() - activeStart : 0);
    }
    function save() {
      saveProgress(computeFraction(), totalTimeMs());
    }

    // Restore only for a genuine mid-story resume (not ~top, not ~end/complete). The programmatic
    // scrollTo fires onScroll, which writes back the same target - harmless.
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    const target = targetRef.current;
    if (target > 0.001 && target < 0.999) {
      const applyRestore = () => {
        const denom = computeDenom();
        if (denom > 0) window.scrollTo(0, target * denom);
      };
      requestAnimationFrame(applyRestore);
      restoreTimer = setTimeout(applyRestore, RESTORE_SETTLE_MS);
    }

    let lastWrite = 0;
    function onScroll() {
      const now = Date.now();
      if (now - lastWrite < PROGRESS_THROTTLE_MS) return;
      lastWrite = now;
      save();
    }
    function onVisibility() {
      if (document.hidden) {
        if (activeStart != null) {
          accumulated += Date.now() - activeStart;
          activeStart = null;
        }
        save(); // persist before the tab may be discarded
      } else if (activeStart == null) {
        activeStart = Date.now();
      }
    }
    const tick = setInterval(save, TICK_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(tick);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      if (restoreTimer) clearTimeout(restoreTimer);
      save(); // final position + time on unmount (in-app nav away from the reader)
    };
  }, []);
}

export type CoverStatus = "idle" | "loading" | "loaded" | "failed";

type StoryReaderProps = {
  genreSelection: GenreSelection;
  title: string;
  story: string;
  coverStatus: CoverStatus;
  coverUrl: string | null;
  /** Where the reader left off (0-1); the view scrolls back to it on resume. 0 for a fresh story. */
  initialProgress: number;
  /** Reading time already banked for this story (ms); the reader keeps accumulating from here. */
  initialTimeSpent: number;
  onRegenerate: () => void;
  onBackToSetup: () => void;
};

// The API returns the story as one string; split on blank-line boundaries into paragraphs.
// If the model didn't include any, this naturally falls back to a single paragraph.
function splitParagraphs(story: string): string[] {
  return story
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function genreDisplay(genreSelection: GenreSelection): { icon: string; label: string; accent: GenreAccent } {
  if (genreSelection.type === "preset") {
    const genre = getGenreById(genreSelection.genreId);
    if (genre) return { icon: genre.icon, label: genre.label, accent: genre.accent };
  }
  // Custom genre text (or an unrecognized preset id) has no GENRES entry to theme from.
  const label = genreSelection.type === "custom" ? genreSelection.text : "Story";
  return { icon: "✨", label, accent: CUSTOM_GENRE_ACCENT };
}

export function StoryCover({ status, url, icon }: { status: CoverStatus; url: string | null; icon: string }) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="story-reader-hero is-loading">
        <div className="story-reader-hero-shimmer" aria-hidden="true" />
        <span className="story-reader-hero-loading">
          <span className="story-reader-hero-palette" aria-hidden="true">🎨</span>
          <span className="story-reader-hero-brush" aria-hidden="true">🖌️</span>
          Painting your cover…
        </span>
      </div>
    );
  }

  if (status === "loaded" && url) {
    // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted covers, no next/image optimizer.
    return <img className="story-reader-hero" src={url} alt="" />;
  }

  // Failed (or loaded with no url): graceful, non-broken fallback; the story stands on its own.
  return (
    <div className="story-reader-hero is-failed" role="img" aria-label="Cover illustration unavailable">
      <span className="story-reader-hero-fail-orb" aria-hidden="true">{icon}</span>
      <span className="story-reader-hero-fail-text">The cover didn&apos;t come through this time — but your story is all here.</span>
    </div>
  );
}

export function StoryReader({ genreSelection, title, story, coverStatus, coverUrl, initialProgress, initialTimeSpent, onRegenerate, onBackToSetup }: StoryReaderProps) {
  const { icon, label, accent } = genreDisplay(genreSelection);
  const paragraphs = splitParagraphs(story);
  const accentVars = { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;
  useReaderProgress(initialProgress, initialTimeSpent);

  return (
    <main className={`story-reader-canvas ${fredoka.variable} ${nunito.variable}`}>
      <div className="story-reader-frame" style={accentVars}>
        <div className="story-reader-glow" aria-hidden="true" />
        <article className="story-reader-page">
          <span className="story-reader-badge">
            <span className="story-reader-badge-icon">{icon}</span>
            <span className="story-reader-badge-label">{label}</span>
          </span>
          <StoryCover status={coverStatus} url={coverUrl} icon={icon} />
          <h1 className="story-reader-title">{title}</h1>
          <div className="story-reader-flourish" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <div className="story-reader-story">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="story-reader-actions">
            <button type="button" onClick={onRegenerate} className="story-reader-btn story-reader-btn-primary">
              <span className="story-reader-btn-icon">↻</span>
              Regenerate
            </button>
            <button type="button" onClick={onBackToSetup} className="story-reader-btn story-reader-btn-secondary">
              ← Back to setup
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}

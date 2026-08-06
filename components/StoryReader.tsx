import { CSSProperties } from "react";
import { fredoka, nunito } from "@/lib/fonts";
import { CUSTOM_GENRE_ACCENT, getGenreById } from "@/lib/genres";
import { GenreAccent, GenreSelection } from "@/lib/types";

export type CoverStatus = "idle" | "loading" | "loaded" | "failed";

type StoryReaderProps = {
  genreSelection: GenreSelection;
  title: string;
  story: string;
  coverStatus: CoverStatus;
  coverUrl: string | null;
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

export function StoryReader({ genreSelection, title, story, coverStatus, coverUrl, onRegenerate, onBackToSetup }: StoryReaderProps) {
  const { icon, label, accent } = genreDisplay(genreSelection);
  const paragraphs = splitParagraphs(story);
  const accentVars = { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;

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

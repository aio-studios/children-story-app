import { CSSProperties } from "react";
import { Fredoka, Nunito } from "next/font/google";
import { CUSTOM_GENRE_ACCENT, getGenreById } from "@/lib/genres";
import { GenreAccent, GenreSelection } from "@/lib/types";

// Scoped to this component only (via CSS variables below) - the rest of the app keeps its current font.
const fredoka = Fredoka({ subsets: ["latin"], weight: ["600"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "800"], variable: "--font-nunito" });

type StoryReaderProps = {
  genreSelection: GenreSelection;
  title: string;
  story: string;
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

function genreDisplay(genreSelection: GenreSelection): { icon: string; label: string; accent: GenreAccent } {
  if (genreSelection.type === "preset") {
    const genre = getGenreById(genreSelection.genreId);
    if (genre) return { icon: genre.icon, label: genre.label, accent: genre.accent };
  }
  // Custom genre text (or an unrecognized preset id) has no GENRES entry to theme from.
  const label = genreSelection.type === "custom" ? genreSelection.text : "Story";
  return { icon: "✨", label, accent: CUSTOM_GENRE_ACCENT };
}

export function StoryReader({ genreSelection, title, story, onRegenerate, onBackToSetup }: StoryReaderProps) {
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

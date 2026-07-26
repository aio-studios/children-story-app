import { CSSProperties } from "react";
import { CUSTOM_GENRE_ACCENT, GENRES, getGenreAccent } from "@/lib/genres";
import { ContinueStory } from "@/lib/storyHistory";

type HomeScreenProps = {
  continueStory: ContinueStory | null;
  onContinue: () => void;
  onSelectGenre: (genreId: string) => void;
  onSelectCustomGenre: () => void;
};

// Hardcoded placeholder shelves (no curated-content or popularity backend yet - decided explicitly, see plan).
const DAILY_PICKS = [
  { title: "The Kindness Dragon", genreId: "fantasy" },
  { title: "Coco's Very Big Shortcut", genreId: "animals" },
  { title: "Nova Builds a Friend", genreId: "sci-fi" },
  { title: "Willow and the Last Star", genreId: "bedtime" },
];
const MOST_POPULAR = [
  { title: "Ember's Tiny Spark", genreId: "fantasy" },
  { title: "Pip Climbs the Cloud Peak", genreId: "adventure" },
  { title: "Snug's Goodnight Hug", genreId: "bedtime" },
  { title: "Blip's Beeping Adventure", genreId: "sci-fi" },
];

function Shelf({ title, items }: { title: string; items: { title: string; genreId: string }[] }) {
  // Placeholder shelves are only 4 cards wide - duplicate so the scroll doesn't dead-end
  // immediately after the last one (real "loop back to start" isn't worth building for sample data).
  const loopedItems = [...items, ...items];
  return (
    <div className="sk-shelf">
      <div className="sk-shelf-head">
        <span className="sk-shelf-title">{title}</span>
      </div>
      <div className="sk-shelf-scroll">
        {loopedItems.map((item, index) => {
          const accent = getGenreAccent(item.genreId);
          const style = { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;
          return (
            <div key={`${item.title}-${index}`} className="sk-shelf-card" style={style}>
              {item.title}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HomeScreen({ continueStory, onContinue, onSelectGenre, onSelectCustomGenre }: HomeScreenProps) {
  const isReturning = continueStory !== null;
  const continueAccent = continueStory
    ? continueStory.genre.type === "preset"
      ? getGenreAccent(continueStory.genre.genreId)
      : CUSTOM_GENRE_ACCENT
    : null;

  return (
    <main className="sk-home">
      <div className="sk-mascot-greet">
        <span className="sk-face">🦉</span>
        <span className="sk-msg">
          {isReturning ? (
            <>Welcome back, Explorer!<br />Ready for a new story?</>
          ) : (
            <>Hi there, Explorer!<br />Let&apos;s make your first story.</>
          )}
        </span>
      </div>

      {continueStory && continueAccent && (
        <button
          type="button"
          onClick={onContinue}
          className="sk-hero"
          style={{ "--accent-light": continueAccent.light, "--accent-dark": continueAccent.dark } as CSSProperties}
        >
          <span className="sk-eyebrow">Continue story</span>
          <span className="sk-title">{continueStory.title}</span>
          <span className="sk-sub">Pick up where you left off</span>
        </button>
      )}

      <Shelf title="Daily picks" items={DAILY_PICKS} />
      <Shelf title="Most popular" items={MOST_POPULAR} />

      <div className="sk-shelf">
        <div className="sk-shelf-head">
          <span className="sk-shelf-title">Start a new story</span>
        </div>
        <div className="sk-genre-strip">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              onClick={() => onSelectGenre(genre.id)}
              className="sk-genre-chip"
              style={{ "--accent-light": genre.accent.light, "--accent-dark": genre.accent.dark } as CSSProperties}
            >
              {genre.icon}
              <span>{genre.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onSelectCustomGenre}
            className="sk-genre-chip"
            style={{ "--accent-light": CUSTOM_GENRE_ACCENT.light, "--accent-dark": CUSTOM_GENRE_ACCENT.dark } as CSSProperties}
          >
            ✨
            <span>Your own</span>
          </button>
        </div>
      </div>
    </main>
  );
}

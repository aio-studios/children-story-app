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

      {/* The whole "start a new story" block sits high (between shelves) so a returning user's
          Continue hero + shelves can't push creation below the fold. */}
      <div className="sk-shelf">
        <div className="sk-shelf-head">
          <span className="sk-shelf-title">Start a new story</span>
        </div>

        <button type="button" onClick={onSelectCustomGenre} className="sk-create-cta">
          <span className="sk-create-cta-ico">
            <span aria-hidden="true">✨</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer. */}
            <img
              src="/create-your-own.jpg"
              alt=""
              width={52}
              height={52}
              loading="lazy"
              className="sk-create-cta-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
          <span className="sk-create-cta-body">
            <span className="sk-create-cta-title">Create your own</span>
            <span className="sk-create-cta-sub">Dream up any character, world &amp; adventure</span>
          </span>
          <span className="sk-create-cta-arrow" aria-hidden="true">›</span>
        </button>

        <div className="sk-genre-strip-label">Or pick a genre</div>
        <div className="sk-genre-strip">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              onClick={() => onSelectGenre(genre.id)}
              className="sk-genre-chip"
              style={{ "--accent-light": genre.accent.light, "--accent-dark": genre.accent.dark } as CSSProperties}
            >
              {genre.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer.
                <img src={genre.image} alt="" width={46} height={46} loading="lazy" className="sk-genre-chip-img" />
              ) : (
                genre.icon
              )}
              <span>{genre.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Shelf title="Most popular" items={MOST_POPULAR} />
    </main>
  );
}

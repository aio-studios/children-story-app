"use client";

import { CSSProperties, useSyncExternalStore } from "react";
import { CUSTOM_GENRE_ACCENT, GENRES, getGenreAccent, getGenreById } from "@/lib/genres";
import {
  ContinueStory,
  getContinueGenre,
  getContinueProgress,
  getContinueTitle,
  isContinueComplete,
  useHasCreatedStory,
} from "@/lib/storyHistory";

type HomeScreenProps = {
  continueStory: ContinueStory | null;
  onContinue: () => void;
  onSelectGenre: (genreId: string) => void;
  onSelectCustomGenre: () => void;
};

/* SVG icons (no emoji in the real UI - matches the nav's SVG set; emoji stays only on the placeholder
   discovery cards, which are stand-in catalog data). currentColor so each themes to its context. */

// Friendly owl mascot for the greeting: filled body + ear tufts, eyes/beak knocked out in the page bg.
function OwlMascot() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M8 9 11 3.5 13.6 9.6Z" fill="currentColor" />
      <path d="M24 9 21 3.5 18.4 9.6Z" fill="currentColor" />
      <path d="M16 6.2c5.6 0 9.6 4.2 9.6 10.8S21.2 28 16 28 6.4 23.6 6.4 17 10.4 6.2 16 6.2Z" fill="currentColor" />
      <circle cx="12" cy="15" r="3.4" fill="var(--sk-bg)" />
      <circle cx="20" cy="15" r="3.4" fill="var(--sk-bg)" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <circle cx="20" cy="15" r="1.5" fill="currentColor" />
      <path d="M16 17.4 14.4 20 17.6 20Z" fill="var(--sk-bg)" />
    </svg>
  );
}

// Play triangle for the Continue card's Resume pill.
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M7 5.5v13l11-6.5Z" />
    </svg>
  );
}

// Faint bookmark watermark on a Continue card that has no cover (fills the corner the emoji used to).
function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="46" height="46" fill="currentColor" aria-hidden="true">
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// Neutral open-book fallback for a genre tile whose art is missing (art is present today, so rare).
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
      <path d="M4 5c3-1 5-1 8 0v14c-3-1-5-1-8 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 5c-3-1-5-1-8 0v14c3-1 5-1 8 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// Placeholder discovery content: there's no stories DB / popularity feed yet (decided explicitly, D7
// in the plan). Real cards with covers + captured metadata replace these once a catalog lands; until
// then the rows degrade gracefully to sample stories on colored cards (no on-the-fly image gen).
type SampleStory = { title: string; genreId: string; level: string; length: string; emoji: string };
const SAMPLE_STORIES: SampleStory[] = [
  { title: "The Kindness Dragon", genreId: "fantasy", level: "Early reader", length: "~2 min", emoji: "🐉" },
  { title: "Coco's Very Big Shortcut", genreId: "animals", level: "Toddler", length: "~2 min", emoji: "🦊" },
  { title: "Nova Builds a Friend", genreId: "sci-fi", level: "Independent", length: "~10 min", emoji: "🤖" },
  { title: "Willow and the Last Star", genreId: "bedtime", level: "Early reader", length: "~2 min", emoji: "🧚" },
  { title: "Pip Climbs the Cloud Peak", genreId: "adventure", level: "Early reader", length: "~10 min", emoji: "🐐" },
  { title: "Ember's Tiny Spark", genreId: "fantasy", level: "Toddler", length: "~2 min", emoji: "🐲" },
  { title: "Baxter's Honey Hunt", genreId: "animals", level: "Toddler", length: "~2 min", emoji: "🐻" },
  { title: "Cosmo Meets a Comet", genreId: "sci-fi", level: "Early reader", length: "~10 min", emoji: "👨‍🚀" },
];

function accentStyle(genreId: string): CSSProperties {
  const accent = getGenreAccent(genreId);
  return { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;
}

// Presentational only (no story to open behind these yet, D7) - a <div>, not a button, so it doesn't
// promise an action it can't keep.
function CoverCard({ story }: { story: SampleStory }) {
  return (
    <div className="sk-cover-card" style={accentStyle(story.genreId)}>
      <span className="sk-cover-art" aria-hidden="true" />
      <span className="sk-cover-scrim" aria-hidden="true" />
      <span className="sk-cover-lvl">{story.level}</span>
      <span className="sk-cover-emoji" aria-hidden="true">{story.emoji}</span>
      <span className="sk-cover-foot">
        <span className="sk-cover-title">{story.title}</span>
        <span className="sk-cover-badges">
          <span className="sk-cover-badge sk-cover-badge-genre">{getGenreById(story.genreId)?.label ?? "Story"}</span>
          <span className="sk-cover-badge">{story.length}</span>
        </span>
      </span>
    </div>
  );
}

function DiscoveryRow({ title, items }: { title: string; items: SampleStory[] }) {
  return (
    <section className="sk-drow">
      <div className="sk-drow-head">
        <span className="sk-drow-title">{title}</span>
      </div>
      <div className="sk-drow-scroll">
        {items.map((story, index) => (
          <CoverCard key={`${story.title}-${index}`} story={story} />
        ))}
      </div>
    </section>
  );
}

type Daypart = "morning" | "afternoon" | "evening";
function daypart(): Daypart {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
const GREETINGS: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

// new Date() is impure, so the time-of-day bits can't be computed in render. Read the daypart through
// the codebase's SSR-safe useSyncExternalStore idiom (like useLayoutMode): null on the server/first
// paint (neutral greeting + daytime mascot), the real daypart on the client - no setState-in-effect,
// no hydration mismatch. Drives both the greeting copy and the time-of-day mascot.
const noopSubscribe = () => () => {};
function useDaypart(): Daypart | null {
  return useSyncExternalStore(noopSubscribe, daypart, () => null);
}

export function HomeScreen({ continueStory, onContinue, onSelectGenre, onSelectCustomGenre }: HomeScreenProps) {
  // #82: "has ever created", not just "has an active slot" - so a returning user who finished their
  // story still gets a returning greeting instead of "let's make your first story".
  const hasCreated = useHasCreatedStory();
  const dp = useDaypart();
  const greeting = dp ? GREETINGS[dp] : "Hello";
  // Book owl by day (morning/afternoon), nightcap owl in the evening (per UAT). SSR/null = daytime.
  const mascotSrc = dp === "evening" ? "/mascot-night.jpg" : "/mascot-book.jpg";

  const continueGenre = continueStory ? getContinueGenre(continueStory) : null;
  const continueAccent = continueGenre
    ? continueGenre.type === "preset"
      ? getGenreAccent(continueGenre.genreId)
      : CUSTOM_GENRE_ACCENT
    : null;
  const progressPct = continueStory ? Math.round(getContinueProgress(continueStory) * 100) : 0;
  // A finished story doesn't offer Continue (UAT): interactive when it ends, classic when read to the
  // bottom. It just doesn't render - there's no library to send them to yet, and a new story replaces it.
  const showContinue = continueStory && continueAccent && !isContinueComplete(continueStory);

  const quickStories = SAMPLE_STORIES.filter((s) => s.length === "~2 min");

  return (
    <main className="sk-home">
      <div className="sk-greet">
        <span className="sk-greet-owl" aria-hidden="true">
          <OwlMascot />
          {/* Illustrated time-of-day mascot overlays the SVG fallback (which shows if the asset 404s);
              a low-cost CSS transform gives it a gentle wave - no sprite frames, no extra bytes. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer. */}
          <img
            src={mascotSrc}
            alt=""
            className="sk-greet-owl-img"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </span>
        <span className="sk-greet-body">
          <span className="sk-greet-eyebrow">{greeting}</span>
          <span className="sk-greet-name">
            {hasCreated ? "Welcome back, Explorer!" : "Hi there, Explorer!"}
          </span>
        </span>
      </div>

      {/* Create block stays pinned at the TOP on every form factor (Sarthak's refinement) - the app's
          primary job leads, before any discovery. */}
      <h2 className="sk-home-q">What story today?</h2>
      <div className="sk-gtiles">
        {GENRES.map((genre) => (
          <button
            key={genre.id}
            type="button"
            onClick={() => onSelectGenre(genre.id)}
            className="sk-gtile"
            style={{ "--accent-light": genre.accent.light, "--accent-dark": genre.accent.dark } as CSSProperties}
          >
            {genre.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer.
              <img src={genre.image} alt="" className="sk-gtile-art" loading="lazy" />
            ) : (
              <span className="sk-gtile-art sk-gtile-art-fallback" aria-hidden="true" />
            )}
            <span className="sk-gtile-scrim" aria-hidden="true" />
            {!genre.image && <span className="sk-gtile-ico" aria-hidden="true"><BookIcon /></span>}
            <span className="sk-gtile-name">{genre.label}</span>
          </button>
        ))}
        {/* "Your own" custom-story tile - an illustrated scene (open book with worlds spilling out) in
            the same storybook style as the genre tiles, so it sits as a natural sixth tile. */}
        <button type="button" onClick={onSelectCustomGenre} className="sk-gtile">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer. */}
          <img src="/your-own.jpg" alt="" className="sk-gtile-art" loading="lazy" />
          <span className="sk-gtile-scrim" aria-hidden="true" />
          <span className="sk-gtile-name">Your own</span>
        </button>
      </div>

      {/* Giant Continue card directly below the create block (Sarthak's refinement) - % read + bar
          from the reader's saved position. Hidden when there's nothing to resume, or once finished. */}
      {showContinue && continueStory && (
        <button
          type="button"
          onClick={onContinue}
          className="sk-chero"
          style={{ "--accent-light": continueAccent!.light, "--accent-dark": continueAccent!.dark } as CSSProperties}
        >
          {/* Gradient art is always the base; a real cover overlays it and, if the Blob URL fails,
              hides itself to fall back to the gradient (graceful cover degradation, as StoryCover/#46). */}
          <span className="sk-chero-art" aria-hidden="true" />
          {continueStory.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted cover, no next/image optimizer.
            <img
              src={continueStory.imageUrl}
              alt=""
              className="sk-chero-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="sk-chero-mark" aria-hidden="true"><BookmarkIcon /></span>
          )}
          <span className="sk-chero-scrim" aria-hidden="true" />
          <span className="sk-chero-cap">
            <span className="sk-chero-eyebrow">Continue story</span>
            <span className="sk-chero-title">{getContinueTitle(continueStory)}</span>
            <span className="sk-chero-meta">
              <span className="sk-chero-pct">{progressPct}%</span>
              <span className="sk-chero-label">{progressPct > 0 ? "read" : "start reading"}</span>
              <span className="sk-chero-resume"><PlayIcon /> Resume</span>
            </span>
          </span>
          <span className="sk-chero-bar" aria-hidden="true">
            <i style={{ width: `${progressPct}%` }} />
          </span>
        </button>
      )}

      <div className="sk-sect-label">Discover</div>
      <DiscoveryRow title="Popular this week" items={SAMPLE_STORIES} />
      <DiscoveryRow title="Quick stories · under 5 min" items={quickStories} />
    </main>
  );
}

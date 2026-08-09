"use client";

import { CSSProperties, ReactNode, useRef, useState } from "react";
import { CUSTOM_GENRE_ACCENT, GENRES, getGenreAccent, getGenreById } from "@/lib/genres";
import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { CustomCharacter, GenreAccent, GenreSelection, SelectedCharacter } from "@/lib/types";
import { useLayoutMode } from "@/lib/useLayoutMode";
import { CustomCharacterForm } from "./CustomCharacterForm";

// Immersive "deck" setup flow (Setup-B, #79) — replaces the three-step SetupStepper. One world at a
// time as full-bleed themed cards you browse (coverflow on portrait/tablet, a split two-pane on short
// landscape), the whole screen tinting to the focused genre. Stage 0 world → 1 hero → 2 customize,
// reusing page.tsx's `setupStep` so draft-survival / resume / back-to-setup all keep working. This
// component is presentational: all selection state + its setters live in page.tsx and come in as
// props (like SetupStepper did); the only local state is which card is centered + custom-input open.
// Design record: docs/designs/v2-redesign-decisions.md · mock: docs/designs/setup-B-responsive.html.

type SetupDeckProps = {
  stage: number; // 0 world · 1 hero · 2 customize (mirrors page.tsx setupStep)
  onStageChange: (stage: number) => void;
  onBackFromWorld: () => void; // back out of the whole flow (→ Home)

  // World stage
  genreSelection: GenreSelection;
  customGenreDraft: string;
  onSelectPresetGenre: (genreId: string) => void;
  onSelectCustomGenre: () => void;
  onCustomGenreTextChange: (text: string) => void;

  // Hero stage
  characterSelection: SelectedCharacter;
  customCharacterDraft: CustomCharacter;
  onCharacterChange: (selection: SelectedCharacter) => void;

  // Customize stage — the same PillSelectors/toggles page.tsx already builds, passed as a fragment so
  // the deck owns only the themed scroll + sticky Create bar. `canCreate` mirrors isLessonReady.
  customizeContent: ReactNode;
  canCreate: boolean;
  onCreate: () => void;
};

// A uniform card descriptor so world genres, hero characters, and the two "make your own" cards all
// render through one coverflow/split path.
type DeckCard = {
  name: string;
  blurb: string;
  art?: string;
  accent: GenreAccent;
  custom: boolean;
};

// Enough of a swipe (px) to count as a deliberate flick rather than a tap wobble.
const SWIPE_THRESHOLD_PX = 40;
// A tap firing right after a swipe-release is the swipe's trailing click — ignore it so a swipe
// doesn't also "choose" the card it landed on.
const SWIPE_CLICK_GUARD_MS = 300;

function firstName(name: string): string {
  return name.split(" the ")[0].split(" ")[0];
}

function accentVars(accent: GenreAccent): CSSProperties {
  return { "--accent-light": accent.light, "--accent-dark": accent.dark } as CSSProperties;
}

function isCustomCharacterReady(c: CustomCharacter): boolean {
  return c.name.trim() !== "" && c.traits.trim() !== "" && c.description.trim() !== "";
}

function worldCards(): DeckCard[] {
  const genres: DeckCard[] = GENRES.map((g) => ({
    name: g.label,
    blurb: g.blurb,
    art: g.image,
    accent: g.accent,
    custom: false,
  }));
  genres.push({
    name: "Your own world",
    blurb: "Describe any world you can dream up — we'll build the story around it.",
    art: "/your-own.jpg",
    accent: CUSTOM_GENRE_ACCENT,
    custom: true,
  });
  return genres;
}

function heroCards(genreId: string): DeckCard[] {
  const genre = getGenreById(genreId);
  if (!genre) return [];
  const cards: DeckCard[] = genre.characters.map((c) => ({
    name: c.name,
    blurb: c.description,
    art: c.image,
    accent: genre.accent,
    custom: false,
  }));
  cards.push({
    name: "Create your own",
    blurb: "Invent a hero — give them a name, a few traits, and a look all their own.",
    art: "/create-hero.jpg", // distinct from the world card's /your-own.jpg (UAT: they read too alike)
    accent: genre.accent,
    custom: true,
  });
  return cards;
}

export function SetupDeck(props: SetupDeckProps) {
  const {
    stage,
    onStageChange,
    onBackFromWorld,
    genreSelection,
    customGenreDraft,
    onSelectPresetGenre,
    onSelectCustomGenre,
    onCustomGenreTextChange,
    characterSelection,
    customCharacterDraft,
    onCharacterChange,
    customizeContent,
    canCreate,
    onCreate,
  } = props;

  const mode = useLayoutMode();
  const isSplit = mode === "landscape";

  // The centered card + whether a focused "make your own" card has committed into its input/form
  // (world = one-line input; hero = the full CustomCharacterForm) are seeded from the current
  // selection for the incoming stage. React's "adjust state when a prop changes during render"
  // pattern re-syncs both on every stage change (entry, advance, Back) — but NOT on rotate or
  // browse, so those don't yank the deck back to the selection.
  function seedForStage(s: number): { focus: number; customOpen: boolean } {
    if (s === 0) {
      if (genreSelection.type === "custom") return { focus: GENRES.length, customOpen: true }; // "Your own world"
      const i = GENRES.findIndex((g) => g.id === genreSelection.genreId);
      return { focus: i >= 0 ? i : 0, customOpen: false };
    }
    if (s === 1 && genreSelection.type === "preset") {
      const genre = getGenreById(genreSelection.genreId);
      const count = genre ? genre.characters.length : 0;
      if (characterSelection.type === "preset" && genre) {
        const i = genre.characters.findIndex((c) => c.id === characterSelection.characterId);
        return { focus: i >= 0 ? i : 0, customOpen: false };
      }
      return { focus: count, customOpen: true }; // "Create your own" hero, form already showing
    }
    return { focus: 0, customOpen: false };
  }

  const [focus, setFocus] = useState(() => seedForStage(stage).focus);
  const [customOpen, setCustomOpen] = useState(() => seedForStage(stage).customOpen);
  const [syncedStage, setSyncedStage] = useState(stage);
  if (stage !== syncedStage) {
    const seed = seedForStage(stage);
    setSyncedStage(stage);
    setFocus(seed.focus);
    setCustomOpen(seed.customOpen);
  }

  const swipeStartX = useRef<number | null>(null);
  const lastSwipeAt = useRef(0);

  const items: DeckCard[] =
    stage === 0 ? worldCards() : genreSelection.type === "preset" ? heroCards(genreSelection.genreId) : [];
  const clampedFocus = Math.min(focus, Math.max(0, items.length - 1));
  const focusedCard: DeckCard | undefined = items[clampedFocus];
  // Whole-screen tint: the focused card's accent on the deck stages, the chosen genre's on customize.
  const stageAccent: GenreAccent =
    stage === 2
      ? genreSelection.type === "preset"
        ? getGenreAccent(genreSelection.genreId)
        : CUSTOM_GENRE_ACCENT
      : (focusedCard?.accent ?? CUSTOM_GENRE_ACCENT);

  function move(dir: number) {
    const n = items.length;
    if (n <= 1) return;
    setFocus((f) => (f + dir + n) % n);
    setCustomOpen(false); // browsing away from a "make your own" card closes its input
  }

  function onPointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (swipeStartX.current == null) return;
    const dx = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      lastSwipeAt.current = Date.now();
      move(dx < 0 ? 1 : -1);
    }
  }

  // Committing the centered card: advance for a real genre/character, or open the input for a custom
  // card. Shared by the centre-card tap, the Continue button, and the split art pane. `fromCard`
  // guards only the card/art taps against a swipe's trailing click — the Continue button lives outside
  // the swipe surface, so gating it there would wrongly swallow a quick "swipe then Continue".
  function chooseFocused(fromCard: boolean) {
    if (fromCard && Date.now() - lastSwipeAt.current < SWIPE_CLICK_GUARD_MS) return;
    const card = items[clampedFocus];
    if (!card) return;

    if (stage === 0) {
      // Committing "Your own world" opens the form panel; its own Continue then advances.
      if (card.custom) {
        if (!customOpen) {
          onSelectCustomGenre();
          setCustomOpen(true);
        }
        return;
      }
      onSelectPresetGenre(GENRES[clampedFocus].id);
      onStageChange(1);
      return;
    }

    // Hero stage (preset genre — custom genre renders the form directly, below). Committing the
    // "Create your own" card opens the form; from there its own Continue button advances, so there's
    // nothing more to do here once it's open.
    if (card.custom) {
      if (!customOpen) {
        onCharacterChange(customCharacterDraft);
        setCustomOpen(true);
      }
      return;
    }
    const genre = getGenreById((genreSelection as { type: "preset"; genreId: string }).genreId);
    if (genre) onCharacterChange({ type: "preset", characterId: genre.characters[clampedFocus].id });
    onStageChange(2);
  }

  const stepHead =
    stage === 1
      ? {
          eyebrow:
            genreSelection.type === "preset"
              ? `${getGenreById(genreSelection.genreId)?.label ?? "Story"} hero`
              : "Your hero",
          title: "Pick your hero",
          sub: "Who is this story about?",
        }
      : { eyebrow: "Choose a world", title: "Which world today?", sub: "Swipe to explore — tap to choose." };

  // Custom "make your own" form panel — one shared full-panel treatment for BOTH the custom world
  // (one field) and the custom hero (three fields), replacing the deck (UAT: keep the two entry
  // experiences consistent). Shown when: a custom genre (its whole hero stage is the form), or a
  // "make your own" card has been committed (customOpen) on either the world or hero deck.
  const heroShowsForm =
    stage === 1 && (genreSelection.type === "custom" || (customOpen && focusedCard?.custom === true));
  const worldShowsForm = stage === 0 && customOpen && focusedCard?.custom === true;
  const showCustomPanel = heroShowsForm || worldShowsForm;

  const customChar: CustomCharacter =
    characterSelection.type === "custom" ? characterSelection : customCharacterDraft;

  return (
    <main className={`sk-deck sk-deck-${mode}`} style={accentVars(stageAccent)}>
      <span className="sk-deck-bg" aria-hidden="true" />

      {/* Back chip — steps back one stage (or closes a custom input) rather than leaving the flow. */}
      <div className="sk-deck-top">
        <button type="button" className="sk-deck-back" onClick={handleBack}>
          <span aria-hidden="true">‹</span> {backLabel()}
        </button>
      </div>

      {stage === 2
        ? renderCustomize()
        : showCustomPanel
          ? renderCustomPanel()
          : isSplit
            ? renderSplit()
            : renderCoverflow()}
    </main>
  );

  function backLabel(): string {
    if (stage === 2) {
      return characterSelection.type === "custom" ? "Your hero" : firstName(displayCharName());
    }
    if (stage === 1) {
      // A preset-genre custom-hero form backs to the character deck first, not all the way to worlds.
      if (customOpen && genreSelection.type === "preset" && focusedCard?.custom) return "Heroes";
      return genreSelection.type === "preset" ? (getGenreById(genreSelection.genreId)?.label ?? "Worlds") : "Worlds";
    }
    // The custom-world form backs to the world deck; the world deck itself backs to Home.
    return worldShowsForm ? "Worlds" : "Home";
  }

  function handleBack() {
    if (stage === 2) {
      onStageChange(1);
      return;
    }
    if (stage === 1) {
      // A preset-genre custom-hero form backs out to the character deck first, not all the way.
      if (customOpen && genreSelection.type === "preset" && focusedCard?.custom) {
        setCustomOpen(false);
        return;
      }
      onStageChange(0);
      return;
    }
    // The custom-world form backs to the world deck; the world deck itself backs to Home.
    if (worldShowsForm) {
      setCustomOpen(false);
      return;
    }
    onBackFromWorld();
  }

  function displayCharName(): string {
    if (characterSelection.type === "custom") return customChar.name || "Your hero";
    const genre = genreSelection.type === "preset" ? getGenreById(genreSelection.genreId) : undefined;
    return genre?.characters.find((c) => c.id === characterSelection.characterId)?.name ?? "Your hero";
  }

  function cardArt(card: DeckCard) {
    return card.art ? (
      // eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer.
      <img src={card.art} alt="" className="sk-deck-art" loading="lazy" />
    ) : (
      <span className="sk-deck-art sk-deck-art-fallback" aria-hidden="true" />
    );
  }

  // ---- Coverflow (portrait + tablet): centered card + a peek of each neighbour, wraps both ends. ----
  function renderCoverflow() {
    const n = items.length;
    const prevI = (clampedFocus - 1 + n) % n;
    const nextI = (clampedFocus + 1) % n;

    function cardEl(idx: number, kind: "prev" | "focus" | "next") {
      const card = items[idx];
      return (
        <button
          type="button"
          className={`sk-deck-card sk-deck-card-${kind}${card.custom ? " sk-deck-card-custom" : ""}`}
          style={accentVars(card.accent)}
          onClick={() => (kind === "focus" ? chooseFocused(true) : (setFocus(idx), setCustomOpen(false)))}
          aria-label={kind === "focus" ? undefined : `Show ${card.name}`}
        >
          {cardArt(card)}
          <span className="sk-deck-card-scrim" aria-hidden="true" />
          <span className="sk-deck-cap">
            <span className="sk-deck-nm">{card.name}</span>
            {kind === "focus" && <span className="sk-deck-bl">{card.blurb}</span>}
          </span>
        </button>
      );
    }

    return (
      <>
        <div className="sk-deck-head">
          <span className="sk-deck-eyebrow">{stepHead.eyebrow}</span>
          <h2 className="sk-deck-title">{stepHead.title}</h2>
          <p className="sk-deck-sub">{stepHead.sub}</p>
        </div>
        <div className="sk-deck-flow" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {n > 1 && cardEl(prevI, "prev")}
          {cardEl(clampedFocus, "focus")}
          {n > 1 && cardEl(nextI, "next")}
          {n > 1 && (
            <>
              <button type="button" className="sk-deck-arrow sk-deck-arrow-prev" aria-label="Previous" onClick={() => move(-1)}>
                ‹
              </button>
              <button type="button" className="sk-deck-arrow sk-deck-arrow-next" aria-label="Next" onClick={() => move(1)}>
                ›
              </button>
            </>
          )}
        </div>
        {renderDots()}
        {renderDeckCta()}
      </>
    );
  }

  // ---- Split (short landscape): full-height art pane left, title/blurb/dots/Continue right. ----
  function renderSplit() {
    const card = focusedCard;
    if (!card) return null;
    return (
      <div className="sk-deck-split">
        {/* Presentational container (not a button), so the prev/next controls are valid sibling
            buttons rather than interactive elements nested inside another button. */}
        <div
          className={`sk-deck-artpane${card.custom ? " sk-deck-card-custom" : ""}`}
          style={accentVars(card.accent)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {cardArt(card)}
          <span className="sk-deck-card-scrim" aria-hidden="true" />
          <span className="sk-deck-cap">
            <span className="sk-deck-nm">{card.name}</span>
          </span>
          {/* Full-bleed transparent overlay = "choose this card"; sits below the arrows so a tap on an
              arrow hits the arrow, not this. Guarded like the coverflow card against a swipe's trailing tap. */}
          <button
            type="button"
            className="sk-deck-artpane-choose"
            aria-label={`Choose ${card.name}`}
            onClick={() => chooseFocused(true)}
          />
          {items.length > 1 && (
            <>
              <button type="button" className="sk-deck-arrow sk-deck-arrow-prev" aria-label="Previous" onClick={() => move(-1)}>
                ‹
              </button>
              <button type="button" className="sk-deck-arrow sk-deck-arrow-next" aria-label="Next" onClick={() => move(1)}>
                ›
              </button>
            </>
          )}
        </div>
        <div className="sk-deck-info">
          <span className="sk-deck-eyebrow">{stepHead.eyebrow}</span>
          <h2 className="sk-deck-title">{stepHead.title}</h2>
          <p className="sk-deck-sub">{stepHead.sub}</p>
          <p className="sk-deck-bl sk-deck-bl-info">{card.blurb}</p>
          <div className="sk-deck-info-foot">
            {renderDots()}
            {renderDeckCta()}
          </div>
        </div>
      </div>
    );
  }

  function renderDots() {
    if (items.length <= 1) return null;
    return (
      <div className="sk-deck-dots">
        {items.map((card, i) => (
          <button
            key={i}
            type="button"
            className={`sk-deck-dot${i === clampedFocus ? " sk-deck-dot-on" : ""}`}
            aria-label={`Go to ${card.name}`}
            aria-current={i === clampedFocus}
            onClick={() => {
              if (i !== clampedFocus) {
                setFocus(i);
                setCustomOpen(false);
              }
            }}
          />
        ))}
      </div>
    );
  }

  // The deck's primary action row: the themed Continue button that commits the focused card. A custom
  // card that isn't open yet reads "Describe it →" (tapping it opens the form panel).
  function renderDeckCta() {
    const label = stage === 0 && focusedCard?.custom ? "Describe it →" : "Continue →";
    return (
      <div className="sk-deck-cta">
        <button type="button" className="sk-deck-go sk-deck-go-block" onClick={() => chooseFocused(false)}>
          {label}
        </button>
      </div>
    );
  }

  // Shared "make your own" form panel — replaces the deck for both the custom world (one field) and
  // the custom hero (the three-field CustomCharacterForm), so the two entry experiences match (UAT).
  function renderCustomPanel() {
    const isWorld = stage === 0;
    const ready = isWorld ? customGenreDraft.trim() !== "" : isCustomCharacterReady(customChar);
    return (
      <>
        <div className="sk-deck-head">
          <span className="sk-deck-eyebrow">{isWorld ? "Your own world" : stepHead.eyebrow}</span>
          <h2 className="sk-deck-title">{isWorld ? "Create your world" : "Create your hero"}</h2>
          <p className="sk-deck-sub">
            {isWorld ? "Describe any world you can dream up." : "Tell us who this story is about."}
          </p>
        </div>
        <div className="sk-deck-formscroll">
          {/* The tapped "make your own" card flips over (and scales up) to reveal its form on the back
              (UAT). Front = the card art, back = the form. Resting state shows the back, so under
              prefers-reduced-motion (flip disabled) it still lands on the usable form. */}
          <div className="sk-flipcard" key={isWorld ? "world" : "hero"}>
            <div className="sk-flipcard-inner">
              <div className="sk-flipcard-front" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art. */}
                <img src={isWorld ? "/your-own.jpg" : "/create-hero.jpg"} alt="" className="sk-flipcard-art" />
              </div>
              <div className="sk-flipcard-back">
                {isWorld ? (
                  <div className="sk-form-panel">
                    {/* Same panel + field styling as CustomCharacterForm, so world (1 field) and hero
                        (3) read as the same kind of screen. */}
                    <label className="sk-form-label">
                      What kind of world?
                      <input
                        type="text"
                        value={customGenreDraft}
                        placeholder="e.g. a floating city of paper lanterns"
                        maxLength={MAX_CUSTOM_TEXT_LENGTH}
                        onChange={(e) => onCustomGenreTextChange(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && ready && onStageChange(1)}
                        className="sk-field font-normal"
                      />
                    </label>
                  </div>
                ) : (
                  <CustomCharacterForm character={customChar} onChange={onCharacterChange} />
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="sk-deck-cta">
          <button
            type="button"
            className="sk-deck-go sk-deck-go-block"
            disabled={!ready}
            onClick={() => ready && onStageChange(isWorld ? 1 : 2)}
          >
            Continue →
          </button>
        </div>
      </>
    );
  }

  // Customize: the same controls page.tsx builds, wrapped in a themed scroll + sticky Create bar.
  function renderCustomize() {
    const genreLabel =
      genreSelection.type === "preset" ? (getGenreById(genreSelection.genreId)?.label ?? "Story") : "Your world";
    return (
      <>
        <div className="sk-deck-head">
          <span className="sk-deck-eyebrow">
            {genreLabel} · {firstName(displayCharName())}
          </span>
          <h2 className="sk-deck-title">Last touches</h2>
          <p className="sk-deck-sub">Customize it, then create.</p>
        </div>
        <div className="sk-deck-custscroll">
          <div className="sk-deck-custbody">{customizeContent}</div>
        </div>
        <div className="sk-deck-createbar">
          <button
            type="button"
            className="sk-deck-go sk-deck-go-block sk-deck-create"
            disabled={!canCreate}
            onClick={onCreate}
          >
            ✦ Create story
          </button>
        </div>
      </>
    );
  }
}

"use client";

import { useRef, useState } from "react";
import { GENRES } from "@/lib/genres";
import {
  DEFAULT_LESSON,
  DEFAULT_READING_LEVEL,
  DEFAULT_STORY_LENGTH,
  DEFAULT_TONE,
  READING_LEVELS,
  STORY_LENGTHS,
  TONES,
} from "@/lib/storyOptions";
import { clearContinueStory, saveContinueStory, useContinueStory } from "@/lib/storyHistory";
import { CustomCharacter, GenreSelection, Lesson, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, Tone } from "@/lib/types";
import { GenreSelector } from "@/components/GenreSelector";
import { CharacterSelector } from "@/components/CharacterSelector";
import { PillSelector } from "@/components/PillSelector";
import { LessonSelector } from "@/components/LessonSelector";
import { IllustrationToggle } from "@/components/IllustrationToggle";
import { CoverStatus, StoryReader } from "@/components/StoryReader";
import { HomeScreen } from "@/components/HomeScreen";
import { SetupStepper } from "@/components/SetupStepper";
import { AppShell } from "@/components/AppShell";

type View = "home" | "setup" | "loading" | "success" | "error";

function isCharacterReady(character: SelectedCharacter): boolean {
  if (character.type === "preset") return true;
  return character.name.trim() !== "" && character.traits.trim() !== "" && character.description.trim() !== "";
}

function isGenreReady(genre: GenreSelection): boolean {
  if (genre.type === "preset") return true;
  return genre.text.trim() !== "";
}

function isLessonReady(lesson: LessonSelection): boolean {
  if (lesson.type === "preset") return true;
  return lesson.text.trim() !== "";
}

function defaultCharacterFor(genreId: string): SelectedCharacter {
  const genre = GENRES.find((g) => g.id === genreId);
  return genre
    ? { type: "preset", characterId: genre.characters[0].id }
    : { type: "custom", name: "", traits: "", description: "" };
}

const EMPTY_CUSTOM_CHARACTER: SelectedCharacter = { type: "custom", name: "", traits: "", description: "" };

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [setupStep, setSetupStep] = useState(0);
  const continueStory = useContinueStory();

  const [genreSelection, setGenreSelection] = useState<GenreSelection>({
    type: "preset",
    genreId: GENRES[0].id,
  });
  // Kept separate from genreSelection so a typed-in custom genre survives switching to a preset and back.
  const [customGenreDraft, setCustomGenreDraft] = useState("");
  const [characterSelection, setCharacterSelection] = useState<SelectedCharacter>({
    type: "preset",
    characterId: GENRES[0].characters[0].id,
  });
  // Kept separate so a typed-in custom character survives selecting a preset (or leaving the step) and
  // coming back - same reason customGenreDraft/customLessonDraft exist for their steps.
  const [customCharacterDraft, setCustomCharacterDraft] = useState<CustomCharacter>({
    type: "custom",
    name: "",
    traits: "",
    description: "",
  });
  const [storyLength, setStoryLength] = useState<StoryLength>(DEFAULT_STORY_LENGTH);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(DEFAULT_READING_LEVEL);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [lessonSelection, setLessonSelection] = useState<LessonSelection>({
    type: "preset",
    lessonId: DEFAULT_LESSON,
  });
  // Kept separate from lessonSelection so a typed-in custom lesson survives switching to a preset and back.
  const [customLessonDraft, setCustomLessonDraft] = useState("");
  const [generatedStory, setGeneratedStory] = useState<{ title: string; story: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Illustration opt-in (#38), default off. Cover state is separate from the story so text can
  // render immediately while the image generates (or fails) in the background.
  const [illustrate, setIllustrate] = useState(false);
  const [coverStatus, setCoverStatus] = useState<CoverStatus>("idle");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // Synchronous guard against a fast double-click firing two requests before the disabled button re-renders.
  const isGeneratingRef = useRef(false);
  // Bumped whenever the user navigates away mid-generation, so a stale fetch resolving after that
  // doesn't hijack the screen they've since moved to (nav menu stays reachable during "loading").
  const activeGenerationRef = useRef(0);

  function selectPresetGenre(genreId: string) {
    if (genreSelection.type === "preset" && genreSelection.genreId === genreId) return;
    setGenreSelection({ type: "preset", genreId });
    setCharacterSelection(defaultCharacterFor(genreId));
  }

  function selectCustomGenre() {
    if (genreSelection.type === "custom") return;
    setGenreSelection({ type: "custom", text: customGenreDraft });
    setCharacterSelection(EMPTY_CUSTOM_CHARACTER);
  }

  function updateCustomGenreText(text: string) {
    setCustomGenreDraft(text);
    setGenreSelection({ type: "custom", text });
  }

  // Persist every edit to the custom character into the draft, so switching to a preset (or navigating
  // away) and returning to "Create your own" restores what was typed instead of a blank form.
  function handleCharacterChange(selection: SelectedCharacter) {
    setCharacterSelection(selection);
    if (selection.type === "custom") setCustomCharacterDraft(selection);
  }

  function selectPresetLesson(lessonId: Lesson) {
    if (lessonSelection.type === "preset" && lessonSelection.lessonId === lessonId) return;
    setLessonSelection({ type: "preset", lessonId });
  }

  function selectCustomLesson() {
    if (lessonSelection.type === "custom") return;
    setLessonSelection({ type: "custom", text: customLessonDraft });
  }

  function updateCustomLessonText(text: string) {
    setCustomLessonDraft(text);
    setLessonSelection({ type: "custom", text });
  }

  function currentSelections() {
    return {
      genre: genreSelection,
      character: characterSelection,
      length: storyLength,
      readingLevel,
      tone,
      lesson: lessonSelection,
    };
  }

  // Non-blocking cover generation (#38): runs after the story is already on screen. Guarded by the
  // same generationId as the story so a slow image resolving after a regenerate/nav doesn't apply.
  async function generateCover(selections: ReturnType<typeof currentSelections>, title: string, story: string, generationId: number) {
    setCoverStatus("loading");
    setCoverUrl(null);
    try {
      const response = await fetch("/api/generate-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections, title }),
      });
      const data = await response.json();
      if (activeGenerationRef.current !== generationId) return;
      if (!response.ok || typeof data.imageUrl !== "string") {
        setCoverStatus("failed");
        return;
      }
      setCoverUrl(data.imageUrl);
      setCoverStatus("loaded");
      saveContinueStory({ title, story, ...selections, imageUrl: data.imageUrl, savedAt: Date.now() });
    } catch {
      if (activeGenerationRef.current !== generationId) return;
      setCoverStatus("failed");
    }
  }

  async function generateStory() {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    const generationId = ++activeGenerationRef.current;
    setView("loading");
    setGenerationError(null);
    setCoverStatus("idle");
    setCoverUrl(null);
    const selections = currentSelections();
    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selections),
      });
      const data = await response.json();
      // The user navigated away (Home/New story) while this request was still in flight -
      // don't yank them back to a screen for a request they've since abandoned.
      if (activeGenerationRef.current !== generationId) return;
      if (!response.ok) {
        setGenerationError(data.error ?? "Something went wrong. Please try again.");
        setView("error");
        return;
      }
      setGeneratedStory({ title: data.title, story: data.story });
      saveContinueStory({ title: data.title, story: data.story, ...selections, savedAt: Date.now() });
      setView("success");
      if (illustrate) {
        void generateCover(selections, data.title, data.story, generationId);
      }
    } catch {
      if (activeGenerationRef.current !== generationId) return;
      setGenerationError("Something went wrong. Please try again.");
      setView("error");
    } finally {
      isGeneratingRef.current = false;
    }
  }

  // Leaving the reader via "Back to setup" reads as "done with this one" - clears the continue slot.
  // Regenerating overwrites it instead (handled inside generateStory), and navigating Home via the
  // nav menu deliberately does NOT clear it, so Home can still offer to resume this story.
  function handleBackToSetupFromReader() {
    clearContinueStory();
    setGenerationError(null);
    setSetupStep(2);
    setView("setup");
  }

  function handleContinueFromHome() {
    if (!continueStory) return;
    setGenreSelection(continueStory.genre);
    // Keep the drafts in sync too, so toggling preset -> custom -> preset -> custom again in
    // Setup doesn't overwrite the resumed text with a stale (likely empty) draft.
    if (continueStory.genre.type === "custom") setCustomGenreDraft(continueStory.genre.text);
    setCharacterSelection(continueStory.character);
    setStoryLength(continueStory.length);
    setReadingLevel(continueStory.readingLevel);
    setTone(continueStory.tone);
    setLessonSelection(continueStory.lesson);
    if (continueStory.lesson.type === "custom") setCustomLessonDraft(continueStory.lesson.text);
    setGeneratedStory({ title: continueStory.title, story: continueStory.story });
    if (continueStory.imageUrl) {
      setCoverUrl(continueStory.imageUrl);
      setCoverStatus("loaded");
    } else {
      setCoverUrl(null);
      setCoverStatus("idle");
    }
    setView("success");
  }

  // Lands on Setup Step 1 (Genre) rather than skipping to Character - the genre still comes in
  // pre-selected, but the jump to a differently-themed screen was confusing without seeing the
  // pick confirmed first. Same landing spot for the custom-genre tile below.
  function handleSelectGenreFromHome(genreId: string) {
    selectPresetGenre(genreId);
    setSetupStep(0);
    setView("setup");
  }

  function handleSelectCustomGenreFromHome() {
    selectCustomGenre();
    setSetupStep(0);
    setView("setup");
  }

  // Abandon any in-flight generation so its response can't hijack the screen the user is
  // navigating to, and free the double-click guard immediately instead of waiting for that
  // stale request to finish.
  function abandonInFlightGeneration() {
    activeGenerationRef.current++;
    isGeneratingRef.current = false;
  }

  function handleNavigateHome() {
    abandonInFlightGeneration();
    setView("home");
  }

  function handleNavigateNewStory() {
    abandonInFlightGeneration();
    setSetupStep(0);
    setView("setup");
  }

  const setupSteps = [
    {
      label: "Genre",
      icon: "🧭",
      isReady: isGenreReady(genreSelection),
      content: (
        <GenreSelector
          selection={genreSelection}
          onSelectPreset={selectPresetGenre}
          onSelectCustom={selectCustomGenre}
          onCustomTextChange={updateCustomGenreText}
        />
      ),
    },
    {
      label: "Character",
      icon: "🥷",
      isReady: isCharacterReady(characterSelection),
      content: (
        <CharacterSelector
          genreSelection={genreSelection}
          characterSelection={characterSelection}
          customDraft={customCharacterDraft}
          onChange={handleCharacterChange}
        />
      ),
    },
    {
      label: "Customize",
      icon: "🎨",
      isReady: isLessonReady(lessonSelection),
      content: (
        <div className="flex flex-col gap-4">
          <PillSelector label="Length" options={STORY_LENGTHS} selected={storyLength} onSelect={setStoryLength} />
          <PillSelector
            label="Reading level"
            options={READING_LEVELS}
            selected={readingLevel}
            onSelect={setReadingLevel}
          />
          <PillSelector label="Tone" options={TONES} selected={tone} onSelect={setTone} />
          <LessonSelector
            selection={lessonSelection}
            onSelectPreset={selectPresetLesson}
            onSelectCustom={selectCustomLesson}
            onCustomTextChange={updateCustomLessonText}
          />
          <IllustrationToggle enabled={illustrate} onChange={setIllustrate} />
        </div>
      ),
    },
  ];

  const pageTitle = view === "setup" ? "New Story" : view === "success" ? generatedStory?.title : undefined;

  return (
    <AppShell
      onNavigateHome={handleNavigateHome}
      onNavigateNewStory={handleNavigateNewStory}
      pageTitle={pageTitle}
      autoHide={view === "success"}
    >
      {view === "home" && (
        <HomeScreen
          continueStory={continueStory}
          onContinue={handleContinueFromHome}
          onSelectGenre={handleSelectGenreFromHome}
          onSelectCustomGenre={handleSelectCustomGenreFromHome}
        />
      )}

      {view === "setup" && (
        <SetupStepper
          steps={setupSteps}
          currentStep={setupStep}
          onStepChange={setSetupStep}
          onBackFromFirstStep={handleNavigateHome}
          onFinish={generateStory}
        />
      )}

      {view === "loading" && (
        <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-6">
          <span className="animate-pencil-write text-5xl">✏️</span>
          <p className="flex items-center gap-1 text-base">
            Writing your story
            <span className="inline-flex gap-0.5">
              <span className="animate-dot-bounce">.</span>
              <span className="animate-dot-bounce animate-dot-bounce-delay-1">.</span>
              <span className="animate-dot-bounce animate-dot-bounce-delay-2">.</span>
            </span>
          </p>
        </main>
      )}

      {view === "success" && generatedStory && (
        <StoryReader
          genreSelection={genreSelection}
          title={generatedStory.title}
          story={generatedStory.story}
          coverStatus={coverStatus}
          coverUrl={coverUrl}
          onRegenerate={generateStory}
          onBackToSetup={handleBackToSetupFromReader}
        />
      )}

      {view === "error" && (
        <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 p-6">
          <p className="text-center text-base">{generationError}</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={generateStory}
              className="sk-nav-btn sk-nav-btn-primary"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupStep(2);
                setView("setup");
              }}
              className="sk-nav-btn"
            >
              ← Back to setup
            </button>
          </div>
        </main>
      )}
    </AppShell>
  );
}

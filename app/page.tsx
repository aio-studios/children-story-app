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
import { InteractiveStory, LENGTH_BEAT_RANGE, StepAction, StepResult } from "@/lib/interactive";
import { CustomCharacter, GenreSelection, Lesson, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, StoryMode, Tone } from "@/lib/types";
import { GenreSelector } from "@/components/GenreSelector";
import { CharacterSelector } from "@/components/CharacterSelector";
import { PillSelector } from "@/components/PillSelector";
import { LessonSelector } from "@/components/LessonSelector";
import { IllustrationToggle } from "@/components/IllustrationToggle";
import { StoryModeToggle } from "@/components/StoryModeToggle";
import { CoverStatus, StoryReader } from "@/components/StoryReader";
import { InteractiveStoryReader } from "@/components/InteractiveStoryReader";
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
  // Mirrors coverUrl so async persistence (a beat resolving concurrently with the up-front cover)
  // always saves the latest image instead of a stale closure value.
  const coverUrlRef = useRef<string | null>(null);
  // Synchronous guard against a fast double-click firing two requests before the disabled button re-renders.
  const isGeneratingRef = useRef(false);
  // Bumped whenever the user navigates away mid-generation, so a stale fetch resolving after that
  // doesn't hijack the screen they've since moved to (nav menu stays reachable during "loading").
  const activeGenerationRef = useRef(0);

  // Interactive mode (#37): opt-in, default classic. The story-state lives client-side and is
  // re-sent to /api/story-step each beat; a ref mirrors it so async cover/persist callbacks always
  // see the latest beats even if the reader has advanced since they started.
  const [mode, setMode] = useState<StoryMode>("classic");
  const [interactiveStory, setInteractiveStory] = useState<InteractiveStory | null>(null);
  const interactiveStoryRef = useRef<InteractiveStory | null>(null);
  const [isStepping, setIsStepping] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const isSteppingRef = useRef(false);
  // The last advance action, so an inline "Try again" after a failed step can retry it.
  const lastActionRef = useRef<StepAction>({ kind: "continue" });

  function setStory(story: InteractiveStory) {
    interactiveStoryRef.current = story;
    setInteractiveStory(story);
  }

  function updateCoverUrl(url: string | null) {
    coverUrlRef.current = url;
    setCoverUrl(url);
  }

  // Interactive mode and illustrations are opt-in, off by default. They persist while moving through
  // the setup steps, but should NOT carry over into the next story - reset them at every boundary
  // where a new story begins or the current one is left for setup. Not reset at creation itself (the
  // success view still reads `mode` to pick the reader) nor on resume (which restores mode/cover).
  function resetOptInToggles() {
    setMode("classic");
    setIllustrate(false);
  }

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

  // Fire-and-forget deletion of a cover Blob that's no longer referenced (#46) - called once the
  // story it belonged to has been replaced or cleared, so we never delete an image the saved
  // continue-slot still points at. Best-effort: failures are swallowed (server also no-ops on a bad URL).
  function discardCover(url: string | null | undefined) {
    if (!url) return;
    void fetch("/api/delete-illustration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  // Non-blocking cover generation (#38): runs after the story is already on screen. Guarded by the
  // same generationId as the story so a slow image resolving after a regenerate/nav doesn't apply.
  async function generateCover(selections: ReturnType<typeof currentSelections>, title: string, story: string, generationId: number) {
    setCoverStatus("loading");
    updateCoverUrl(null);
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
      updateCoverUrl(data.imageUrl);
      setCoverStatus("loaded");
      saveContinueStory({ title, story, ...selections, imageUrl: data.imageUrl });
    } catch {
      if (activeGenerationRef.current !== generationId) return;
      setCoverStatus("failed");
    }
  }

  async function generateStory() {
    if (mode === "interactive") {
      void beginInteractive();
      return;
    }
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    const generationId = ++activeGenerationRef.current;
    // The cover the outgoing story used (from the reader, or restored into the continue slot). Once
    // this new story commits below it's orphaned, so we delete its Blob (#46). Captured before any
    // state resets so a regenerate/new-story doesn't leave the old image behind.
    const previousImageUrl = coverUrl ?? continueStory?.imageUrl ?? null;
    setView("loading");
    setGenerationError(null);
    setCoverStatus("idle");
    updateCoverUrl(null);
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
      saveContinueStory({ title: data.title, story: data.story, ...selections });
      // The new story now owns the continue slot (with no image yet), so the old cover is orphaned.
      discardCover(previousImageUrl);
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

  function persistInteractive(story: InteractiveStory, imageUrl: string | null) {
    saveContinueStory({ mode: "interactive", interactive: story, imageUrl: imageUrl ?? undefined });
  }

  async function requestStep(story: InteractiveStory, action: StepAction): Promise<StepResult> {
    const response = await fetch("/api/story-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, action }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
    return data as StepResult;
  }

  // Single cover for an interactive story (#38), same as classic. Persists against the LATEST beats
  // (via the ref) so a cover arriving after the reader advanced doesn't roll the saved story back.
  async function generateInteractiveCover(selections: ReturnType<typeof currentSelections>, title: string, generationId: number) {
    setCoverStatus("loading");
    updateCoverUrl(null);
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
      updateCoverUrl(data.imageUrl);
      setCoverStatus("loaded");
      if (interactiveStoryRef.current) persistInteractive(interactiveStoryRef.current, data.imageUrl);
    } catch {
      if (activeGenerationRef.current !== generationId) return;
      setCoverStatus("failed");
    }
  }

  // Starts an interactive story: seeds an empty state and generates the opening beat behind the
  // full-screen "loading" view, then hands off to the reader for subsequent beats.
  async function beginInteractive() {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    const generationId = ++activeGenerationRef.current;
    const previousImageUrl = coverUrl ?? continueStory?.imageUrl ?? null;
    setView("loading");
    setGenerationError(null);
    setStepError(null);
    setCoverStatus("idle");
    updateCoverUrl(null);
    const selections = currentSelections();
    const range = LENGTH_BEAT_RANGE[selections.length];
    const base: InteractiveStory = {
      title: "",
      selections,
      arc: { min: range.min, max: range.max, current: 0 },
      beats: [],
      choices: [],
      beatChoices: [],
      ended: false,
    };
    try {
      const res = await requestStep(base, { kind: "continue" });
      if (activeGenerationRef.current !== generationId) return;
      const story: InteractiveStory = {
        title: res.title,
        selections,
        arc: { min: range.min, max: range.max, current: 1 },
        beats: [res.beatText],
        choices: res.choices,
        beatChoices: [res.choices],
        ended: res.isEnding,
      };
      setStory(story);
      persistInteractive(story, null);
      // The new story owns the continue slot now, so any previous cover Blob is orphaned (#46).
      discardCover(previousImageUrl);
      setView("success");
      if (illustrate) void generateInteractiveCover(selections, res.title, generationId);
    } catch (error) {
      if (activeGenerationRef.current !== generationId) return;
      setGenerationError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setView("error");
    } finally {
      isGeneratingRef.current = false;
    }
  }

  // Advances one beat. `base` overrides the current story (used by "Redo last part", which replays
  // from a trimmed history). Errors surface inline in the reader dock without leaving the story.
  async function advanceInteractive(action: StepAction, base?: InteractiveStory) {
    const current = base ?? interactiveStoryRef.current;
    if (!current || isSteppingRef.current) return;
    const generationId = activeGenerationRef.current;
    isSteppingRef.current = true;
    lastActionRef.current = action;
    setIsStepping(true);
    setStepError(null);
    try {
      const res = await requestStep(current, action);
      if (activeGenerationRef.current !== generationId) return;
      const story: InteractiveStory = {
        title: current.title || res.title,
        selections: current.selections,
        arc: { ...current.arc, current: current.beats.length + 1 },
        beats: [...current.beats, res.beatText],
        choices: res.choices,
        beatChoices: [...current.beatChoices, res.choices],
        ended: res.isEnding,
      };
      setStory(story);
      persistInteractive(story, coverUrlRef.current);
    } catch (error) {
      if (activeGenerationRef.current !== generationId) return;
      setStepError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      isSteppingRef.current = false;
      setIsStepping(false);
    }
  }

  // "Go back a step": drop the last beat and return to the previous decision point with its original
  // choices restored (from beatChoices) - no API call, so the reader can re-pick a different direction.
  function goBackOneBeat() {
    const current = interactiveStoryRef.current;
    if (!current || current.beats.length <= 1 || isSteppingRef.current) return;
    const keep = current.beats.length - 1;
    const beats = current.beats.slice(0, keep);
    const beatChoices = current.beatChoices.slice(0, keep);
    const story: InteractiveStory = {
      ...current,
      beats,
      beatChoices,
      choices: beatChoices[keep - 1] ?? [],
      arc: { ...current.arc, current: keep },
      ended: false,
    };
    setStory(story);
    persistInteractive(story, coverUrlRef.current);
  }

  function retryStep() {
    void advanceInteractive(lastActionRef.current);
  }

  // Leaving a finished interactive story ("Make another story") - same cleanup as the classic
  // "Back to setup", then a fresh Setup from step 1.
  function handleInteractiveExit() {
    discardCover(coverUrl);
    clearContinueStory();
    interactiveStoryRef.current = null;
    setInteractiveStory(null);
    setStepError(null);
    resetOptInToggles();
    setSetupStep(0);
    setView("setup");
  }

  // Leaving the reader via "Back to setup" reads as "done with this one" - clears the continue slot.
  // Regenerating overwrites it instead (handled inside generateStory), and navigating Home via the
  // nav menu deliberately does NOT clear it, so Home can still offer to resume this story.
  function handleBackToSetupFromReader() {
    // Clearing the slot orphans this story's cover Blob - delete it too (#46).
    discardCover(coverUrl);
    clearContinueStory();
    setGenerationError(null);
    resetOptInToggles();
    setSetupStep(2);
    setView("setup");
  }

  function handleContinueFromHome() {
    if (!continueStory) return;
    if (continueStory.mode === "interactive") {
      const resumed = continueStory.interactive;
      setMode("interactive");
      setGenreSelection(resumed.selections.genre);
      if (resumed.selections.genre.type === "custom") setCustomGenreDraft(resumed.selections.genre.text);
      // Older saved stories (before per-beat choice history) have no beatChoices - rebuild a best-
      // effort one so "Go back" works: only the current decision's options are known, earlier ones
      // fall back to empty (the reader still offers ▶ / write-your-own there).
      const beatChoices =
        Array.isArray(resumed.beatChoices) && resumed.beatChoices.length === resumed.beats.length
          ? resumed.beatChoices
          : resumed.beats.map((_, i) => (i === resumed.beats.length - 1 ? resumed.choices : []));
      setStory({ ...resumed, beatChoices });
      if (continueStory.imageUrl) {
        updateCoverUrl(continueStory.imageUrl);
        setCoverStatus("loaded");
      } else {
        updateCoverUrl(null);
        setCoverStatus("idle");
      }
      setStepError(null);
      setView("success");
      return;
    }
    setMode("classic");
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
      updateCoverUrl(continueStory.imageUrl);
      setCoverStatus("loaded");
    } else {
      updateCoverUrl(null);
      setCoverStatus("idle");
    }
    setView("success");
  }

  // Lands on Setup Step 1 (Genre) rather than skipping to Character - the genre still comes in
  // pre-selected, but the jump to a differently-themed screen was confusing without seeing the
  // pick confirmed first. Same landing spot for the custom-genre tile below.
  function handleSelectGenreFromHome(genreId: string) {
    resetOptInToggles();
    selectPresetGenre(genreId);
    setSetupStep(0);
    setView("setup");
  }

  function handleSelectCustomGenreFromHome() {
    resetOptInToggles();
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
    resetOptInToggles();
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
          <StoryModeToggle mode={mode} onChange={setMode} />
          <IllustrationToggle enabled={illustrate} onChange={setIllustrate} />
        </div>
      ),
    },
  ];

  const pageTitle =
    view === "setup"
      ? "New Story"
      : view === "success"
        ? mode === "interactive"
          ? interactiveStory?.title
          : generatedStory?.title
        : undefined;

  return (
    <AppShell
      onNavigateHome={handleNavigateHome}
      onNavigateNewStory={handleNavigateNewStory}
      pageTitle={pageTitle}
      activeTab={view === "home" ? "home" : view === "setup" ? "create" : undefined}
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

      {view === "success" && mode === "interactive" && interactiveStory && (
        <InteractiveStoryReader
          genreSelection={genreSelection}
          story={interactiveStory}
          coverStatus={coverStatus}
          coverUrl={coverUrl}
          isStepping={isStepping}
          stepError={stepError}
          onAdvance={advanceInteractive}
          onRetry={retryStep}
          onGoBack={goBackOneBeat}
          onBackToSetup={handleInteractiveExit}
        />
      )}

      {view === "success" && mode === "classic" && generatedStory && (
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

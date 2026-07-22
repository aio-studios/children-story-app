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
import { GenreSelection, Lesson, LessonSelection, ReadingLevel, SelectedCharacter, StoryLength, Tone } from "@/lib/types";
import { GenreSelector } from "@/components/GenreSelector";
import { CharacterSelector } from "@/components/CharacterSelector";
import { PillSelector } from "@/components/PillSelector";
import { LessonSelector } from "@/components/LessonSelector";

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

function BackToSetupButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border-2 border-blue-600 px-4 py-3 text-center font-medium text-blue-600"
    >
      ← Back to setup
    </button>
  );
}

export default function Home() {
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
  const [storyLength, setStoryLength] = useState<StoryLength>(DEFAULT_STORY_LENGTH);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(DEFAULT_READING_LEVEL);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [lessonSelection, setLessonSelection] = useState<LessonSelection>({
    type: "preset",
    lessonId: DEFAULT_LESSON,
  });
  // Kept separate from lessonSelection so a typed-in custom lesson survives switching to a preset and back.
  const [customLessonDraft, setCustomLessonDraft] = useState("");
  const [generationState, setGenerationState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generatedStory, setGeneratedStory] = useState<{ title: string; story: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Synchronous guard against a fast double-click firing two requests before the disabled button re-renders.
  const isGeneratingRef = useRef(false);

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

  // storyLength/readingLevel/tone always hold a valid selection (fixed defaults, no "unset" state);
  // lesson can be an incomplete custom entry, same as genre/character.
  const isReady = isGenreReady(genreSelection) && isCharacterReady(characterSelection) && isLessonReady(lessonSelection);

  async function generateStory() {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setGenerationState("loading");
    setGenerationError(null);
    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: genreSelection,
          character: characterSelection,
          length: storyLength,
          readingLevel,
          tone,
          lesson: lessonSelection,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setGenerationError(data.error ?? "Something went wrong. Please try again.");
        setGenerationState("error");
        return;
      }
      setGeneratedStory({ title: data.title, story: data.story });
      setGenerationState("success");
    } catch {
      setGenerationError("Something went wrong. Please try again.");
      setGenerationState("error");
    } finally {
      isGeneratingRef.current = false;
    }
  }

  function backToSetup() {
    setGenerationState("idle");
    setGeneratedStory(null);
    setGenerationError(null);
  }

  if (generationState === "loading") {
    return (
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
    );
  }

  if (generationState === "success" && generatedStory) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">{generatedStory.title}</h1>
        <p className="whitespace-pre-wrap text-base leading-relaxed">{generatedStory.story}</p>
        <BackToSetupButton onClick={backToSetup} />
      </main>
    );
  }

  if (generationState === "error") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <p className="text-base">{generationError}</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={generateStory}
            className="rounded-lg bg-blue-500 px-4 py-3 font-medium text-white"
          >
            Try again
          </button>
          <BackToSetupButton onClick={backToSetup} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Pick a genre</h1>
        <GenreSelector
          selection={genreSelection}
          onSelectPreset={selectPresetGenre}
          onSelectCustom={selectCustomGenre}
          onCustomTextChange={updateCustomGenreText}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Pick a character</h2>
        <CharacterSelector
          genreSelection={genreSelection}
          characterSelection={characterSelection}
          onChange={setCharacterSelection}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Customize your story</h2>
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
      </section>

      <button
        type="button"
        disabled={!isReady}
        onClick={generateStory}
        className={`rounded-lg px-4 py-3 text-center font-medium ${
          isReady ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-400"
        }`}
      >
        Continue
      </button>
    </main>
  );
}

"use client";

import { useState } from "react";
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
        disabled
        className={`rounded-lg px-4 py-3 text-center font-medium ${
          isReady ? "bg-blue-300 text-white" : "bg-gray-200 text-gray-400"
        }`}
      >
        Continue (more steps coming soon)
      </button>
    </main>
  );
}

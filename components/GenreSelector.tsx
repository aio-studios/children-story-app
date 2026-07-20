"use client";

import { GENRES } from "@/lib/genres";
import { GenreSelection } from "@/lib/types";
import { GenreCard } from "./GenreCard";
import { CustomGenreCard } from "./CustomGenreCard";

type GenreSelectorProps = {
  selection: GenreSelection;
  onSelectPreset: (genreId: string) => void;
  onSelectCustom: () => void;
  onCustomTextChange: (text: string) => void;
};

export function GenreSelector({ selection, onSelectPreset, onSelectCustom, onCustomTextChange }: GenreSelectorProps) {
  const customText = selection.type === "custom" ? selection.text : "";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {GENRES.map((genre) => (
        <GenreCard
          key={genre.id}
          genre={genre}
          selected={selection.type === "preset" && selection.genreId === genre.id}
          onSelect={() => onSelectPreset(genre.id)}
        />
      ))}
      <CustomGenreCard
        selected={selection.type === "custom"}
        text={customText}
        onSelect={onSelectCustom}
        onTextChange={onCustomTextChange}
      />
    </div>
  );
}

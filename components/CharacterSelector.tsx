import { GENRES } from "@/lib/genres";
import { CustomCharacter, GenreSelection, SelectedCharacter } from "@/lib/types";
import { CharacterCard } from "./CharacterCard";
import { CustomCharacterForm } from "./CustomCharacterForm";

const EMPTY_CUSTOM_CHARACTER: CustomCharacter = { type: "custom", name: "", traits: "", description: "" };

type CharacterSelectorProps = {
  genreSelection: GenreSelection;
  characterSelection: SelectedCharacter;
  onChange: (selection: SelectedCharacter) => void;
};

export function CharacterSelector({ genreSelection, characterSelection, onChange }: CharacterSelectorProps) {
  // A typed-in custom genre has no matching preset characters, so go straight to the custom character form.
  if (genreSelection.type === "custom") {
    const custom = characterSelection.type === "custom" ? characterSelection : EMPTY_CUSTOM_CHARACTER;
    return <CustomCharacterForm character={custom} onChange={onChange} />;
  }

  const genre = GENRES.find((g) => g.id === genreSelection.genreId);
  if (!genre) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 italic">{genre.blurb}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {genre.characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={characterSelection.type === "preset" && characterSelection.characterId === character.id}
            onSelect={() => onChange({ type: "preset", characterId: character.id })}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange(EMPTY_CUSTOM_CHARACTER)}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
            characterSelection.type === "custom" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">✏️</div>
          <span className="text-sm font-medium text-gray-900">Create your own</span>
        </button>
      </div>
      {characterSelection.type === "custom" && (
        <CustomCharacterForm character={characterSelection} onChange={onChange} />
      )}
    </div>
  );
}

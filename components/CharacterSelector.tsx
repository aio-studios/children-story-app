import { GENRES } from "@/lib/genres";
import { CustomCharacter, GenreSelection, SelectedCharacter } from "@/lib/types";
import { CharacterCard } from "./CharacterCard";
import { CustomCharacterForm } from "./CustomCharacterForm";

type CharacterSelectorProps = {
  genreSelection: GenreSelection;
  characterSelection: SelectedCharacter;
  // Preserved custom-character input, so re-selecting "Create your own" restores it instead of blanking.
  customDraft: CustomCharacter;
  onChange: (selection: SelectedCharacter) => void;
};

export function CharacterSelector({ genreSelection, characterSelection, customDraft, onChange }: CharacterSelectorProps) {
  // A typed-in custom genre has no matching preset characters, so go straight to the custom character form.
  if (genreSelection.type === "custom") {
    const custom = characterSelection.type === "custom" ? characterSelection : customDraft;
    return <CustomCharacterForm character={custom} onChange={onChange} />;
  }

  const genre = GENRES.find((g) => g.id === genreSelection.genreId);
  if (!genre) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm italic text-[color:var(--sk-ink-soft)]">{genre.blurb}</p>
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
          onClick={() => onChange(customDraft)}
          className={`sk-select-card justify-center ${
            characterSelection.type === "custom" ? "sk-select-card-selected" : ""
          }`}
        >
          <div className="sk-orb-neutral flex h-16 w-16 items-center justify-center rounded-full text-2xl">✏️</div>
          <span className="text-sm font-medium">Create your own</span>
        </button>
      </div>
      {characterSelection.type === "custom" && (
        <CustomCharacterForm character={characterSelection} onChange={onChange} />
      )}
    </div>
  );
}

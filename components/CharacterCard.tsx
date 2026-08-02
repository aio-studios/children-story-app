import { PresetCharacter } from "@/lib/types";

type CharacterCardProps = {
  character: PresetCharacter;
  selected: boolean;
  onSelect: () => void;
};

export function CharacterCard({ character, selected, onSelect }: CharacterCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`sk-select-card ${selected ? "sk-select-card-selected" : ""}`}
    >
      {/* Placeholder for real character art, decided later */}
      <div className="sk-orb-neutral flex h-16 w-16 items-center justify-center rounded-full text-2xl">🧑</div>
      <span className="text-sm font-medium">{character.name}</span>
      <span className="text-xs text-[color:var(--sk-ink-soft)]">{character.description}</span>
    </button>
  );
}

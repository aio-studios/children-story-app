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
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Placeholder for real character art, decided later */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">🧑</div>
      <span className="text-sm font-medium text-gray-900">{character.name}</span>
      <span className="text-xs text-gray-500">{character.description}</span>
    </button>
  );
}

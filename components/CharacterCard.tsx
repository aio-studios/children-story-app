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
      {character.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer.
        <img
          src={character.image}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="sk-orb-neutral flex h-16 w-16 items-center justify-center rounded-full text-2xl">🧑</div>
      )}
      <span className="text-body font-medium">{character.name}</span>
      <span className="text-note text-[color:var(--sk-ink-soft)]">{character.description}</span>
    </button>
  );
}

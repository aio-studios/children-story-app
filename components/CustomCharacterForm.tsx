import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { CustomCharacter } from "@/lib/types";

type CustomCharacterFormProps = {
  character: CustomCharacter;
  onChange: (character: CustomCharacter) => void;
};

export function CustomCharacterForm({ character, onChange }: CustomCharacterFormProps) {
  return (
    <div className="sk-form-panel">
      <label className="flex flex-col gap-1 text-body font-medium">
        Name
        <input
          type="text"
          value={character.name}
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, name: e.target.value })}
          className="sk-field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-body font-medium">
        Traits
        <input
          type="text"
          value={character.traits}
          placeholder="e.g. brave, loves dinosaurs"
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, traits: e.target.value })}
          className="sk-field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-body font-medium">
        Appearance / personality description
        <textarea
          value={character.description}
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, description: e.target.value })}
          className="sk-field font-normal"
          rows={2}
        />
      </label>
    </div>
  );
}

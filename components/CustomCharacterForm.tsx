import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { CustomCharacter } from "@/lib/types";

type CustomCharacterFormProps = {
  character: CustomCharacter;
  onChange: (character: CustomCharacter) => void;
};

export function CustomCharacterForm({ character, onChange }: CustomCharacterFormProps) {
  return (
    <div className="sk-form-panel">
      <label className="sk-form-label">
        What&apos;s their name?
        <input
          type="text"
          value={character.name}
          placeholder="e.g. Milo, Princess Bo…"
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, name: e.target.value })}
          className="sk-field font-normal"
        />
      </label>
      <label className="sk-form-label">
        What are they like?
        <input
          type="text"
          value={character.traits}
          placeholder="e.g. brave, loves dinosaurs"
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, traits: e.target.value })}
          className="sk-field font-normal"
        />
      </label>
      <label className="sk-form-label">
        What do they look like?
        <textarea
          value={character.description}
          placeholder="e.g. a tiny robot with a big smile and a cape"
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, description: e.target.value })}
          className="sk-field font-normal"
          rows={2}
        />
      </label>
    </div>
  );
}

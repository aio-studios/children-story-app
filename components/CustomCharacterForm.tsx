import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { CustomCharacter } from "@/lib/types";

type CustomCharacterFormProps = {
  character: CustomCharacter;
  onChange: (character: CustomCharacter) => void;
};

export function CustomCharacterForm({ character, onChange }: CustomCharacterFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-blue-500 bg-blue-50 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
        Name
        <input
          type="text"
          value={character.name}
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, name: e.target.value })}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-normal text-gray-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
        Traits
        <input
          type="text"
          value={character.traits}
          placeholder="e.g. brave, loves dinosaurs"
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, traits: e.target.value })}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-normal text-gray-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-900">
        Appearance / personality description
        <textarea
          value={character.description}
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          onChange={(e) => onChange({ ...character, description: e.target.value })}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-normal text-gray-900"
          rows={2}
        />
      </label>
    </div>
  );
}

import { LESSONS, MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";
import { Lesson, LessonSelection } from "@/lib/types";
import { PillSelector } from "./PillSelector";

type LessonSelectorProps = {
  selection: LessonSelection;
  onSelectPreset: (lessonId: Lesson) => void;
  onSelectCustom: () => void;
  onCustomTextChange: (text: string) => void;
};

export function LessonSelector({ selection, onSelectPreset, onSelectCustom, onCustomTextChange }: LessonSelectorProps) {
  const customText = selection.type === "custom" ? selection.text : "";

  return (
    <div className="flex flex-col gap-2">
      <PillSelector
        label="Lesson / value"
        options={LESSONS}
        selected={selection.type === "preset" ? selection.lessonId : undefined}
        onSelect={onSelectPreset}
      >
        <button
          type="button"
          onClick={onSelectCustom}
          className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
            selection.type === "custom" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-900"
          }`}
        >
          ✏️ Type your own
        </button>
      </PillSelector>
      {selection.type === "custom" && (
        <input
          type="text"
          value={customText}
          onChange={(e) => onCustomTextChange(e.target.value)}
          placeholder="e.g. patience, teamwork..."
          maxLength={MAX_CUSTOM_TEXT_LENGTH}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
        />
      )}
    </div>
  );
}

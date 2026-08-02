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
          className={`sk-pill ${selection.type === "custom" ? "sk-pill-selected" : ""}`}
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
          className="sk-field"
        />
      )}
    </div>
  );
}

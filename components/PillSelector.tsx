import { ReactNode } from "react";
import { PillOption } from "@/lib/types";

type PillSelectorProps<T extends string> = {
  label: string;
  options: PillOption<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
  // Extra trailing pill(s) in the same row, e.g. a "type your own" trigger — used by LessonSelector.
  children?: ReactNode;
};

export function PillSelector<T extends string>({ label, options, selected, onSelect, children }: PillSelectorProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
              selected === option.id ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-900"
            }`}
          >
            {option.label}
          </button>
        ))}
        {children}
      </div>
    </div>
  );
}

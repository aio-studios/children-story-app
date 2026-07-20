"use client";

import { useRef } from "react";

type CustomGenreCardProps = {
  selected: boolean;
  text: string;
  onSelect: () => void;
  onTextChange: (text: string) => void;
};

export function CustomGenreCard({ selected, text, onSelect, onTextChange }: CustomGenreCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => {
        onSelect();
        inputRef.current?.focus();
      }}
      className={`flex cursor-text flex-col items-center gap-2 rounded-xl border-2 p-4 ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-3xl">✏️</div>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder="Type your own..."
        onFocus={onSelect}
        onChange={(e) => onTextChange(e.target.value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
      />
    </div>
  );
}

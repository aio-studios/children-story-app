"use client";

import { useRef } from "react";
import { MAX_CUSTOM_TEXT_LENGTH } from "@/lib/storyOptions";

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
      className={`sk-select-card sk-select-card-text ${selected ? "sk-select-card-selected" : ""}`}
    >
      <div className="sk-orb-neutral flex h-20 w-20 items-center justify-center rounded-full text-3xl">✏️</div>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder="Type here…"
        maxLength={MAX_CUSTOM_TEXT_LENGTH}
        onFocus={onSelect}
        onChange={(e) => onTextChange(e.target.value)}
        className="sk-field"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Genre } from "@/lib/types";

const ACTIVE_DURATION_MS = 5000;

type GenreCardProps = {
  genre: Genre;
  selected: boolean;
  onSelect: () => void;
};

export function GenreCard({ genre, selected, onSelect }: GenreCardProps) {
  const [isActive, setIsActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cut the active animation short if another card gets selected instead.
    if (!selected && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setIsActive(false);
    }
  }, [selected]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick() {
    onSelect();
    setIsActive(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsActive(false), ACTIVE_DURATION_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Placeholder for the real GIF/video asset (provider/format TBD) */}
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-300 to-purple-300 text-3xl ${
          isActive ? "animate-active-loop" : "animate-idle-loop"
        }`}
      >
        {genre.icon}
      </div>
      <span className="text-sm font-medium text-gray-900">{genre.label}</span>
    </button>
  );
}

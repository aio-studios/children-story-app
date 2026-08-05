"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
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
      className={`sk-select-card ${selected ? "sk-select-card-selected" : ""}`}
    >
      {genre.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized static /public art, no next/image optimizer.
        <img
          src={genre.image}
          alt=""
          width={80}
          height={80}
          loading="lazy"
          className={`h-20 w-20 rounded-full object-cover ${isActive ? "animate-active-loop" : "animate-idle-loop"}`}
        />
      ) : (
        <div
          className={`sk-orb-accent flex h-20 w-20 items-center justify-center rounded-full text-3xl ${
            isActive ? "animate-active-loop" : "animate-idle-loop"
          }`}
          style={{ "--accent-light": genre.accent.light, "--accent-dark": genre.accent.dark } as CSSProperties}
        >
          {genre.icon}
        </div>
      )}
      <span className="text-sm font-medium">{genre.label}</span>
    </button>
  );
}

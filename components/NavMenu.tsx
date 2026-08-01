"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fredoka, nunito } from "@/lib/fonts";

type NavMenuProps = {
  onNavigateHome: () => void;
  onNavigateNewStory: () => void;
};

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L19 19M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11L12 4L20 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 10V19C6 19.55 6.45 20 7 20H17C17.55 20 18 19.55 18 19V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NewStoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NavMenu({ onNavigateHome, onNavigateNewStory }: NavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Capture the trigger button now so cleanup restores focus to the element that opened the
    // menu, rather than reading openButtonRef.current at teardown (React ref-in-cleanup footgun).
    const triggerButton = openButtonRef.current;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    // Lock background scroll while the panel covers the screen - without this, touch devices can
    // still drag-scroll the page underneath the fixed overlay (iOS Safari "scroll-through").
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerButton?.focus();
    };
  }, [isOpen]);

  function go(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="sk-icon-btn"
      >
        <MenuIcon />
      </button>
      {isOpen &&
        createPortal(
          // Portaled to <body>: .sk-topbar is `position: sticky`, which creates a containing block
          // for `position: fixed` descendants - rendered inline here, inset:0 would resolve against
          // the ~48px header instead of the viewport. next/font's --font-fredoka/--font-nunito
          // variables are scoped to whatever element carries `.variable` (normally .sk-shell) - a
          // portal to document.body escapes that subtree, so the variable classes are reapplied
          // here too (the --sk-* color tokens hit the same issue and were fixed by moving them to
          // :root instead; these are per-font-instance classNames from next/font, not something we
          // control the scope of, so reapplying the class is the fix here).
          <div className={`sk-nav-panel ${fredoka.variable} ${nunito.variable}`}>
            <div className="sk-nav-panel-backdrop" onClick={() => setIsOpen(false)} />
            <div className="sk-nav-panel-menu">
              <div className="sk-nav-panel-head">
                <span className="sk-nav-panel-brand">Storykins</span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsOpen(false)}
                  className="sk-nav-panel-close"
                >
                  <CloseIcon />
                </button>
              </div>
              <nav className="sk-nav-panel-links" aria-label="Main menu">
                <button type="button" className="sk-nav-panel-link" onClick={() => go(onNavigateHome)}>
                  <HomeIcon />
                  Home
                </button>
                <button type="button" className="sk-nav-panel-link" onClick={() => go(onNavigateNewStory)}>
                  <NewStoryIcon />
                  New story
                </button>
              </nav>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

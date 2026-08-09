"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { fredoka, nunito } from "@/lib/fonts";
import { useLayoutMode } from "@/lib/useLayoutMode";
import { AppNav } from "./AppNav";
import { NavMenu } from "./NavMenu";

type AppShellProps = {
  onNavigateHome: () => void;
  onNavigateNewStory: () => void;
  /** Page-aware center title for the reader's top bar (the story title). */
  pageTitle?: string;
  /** Which global-nav destination the current view maps to, for the active highlight. */
  activeTab?: "home" | "create";
  /** Story-reader mode: hides the global nav (immersive, D1) and swaps in the slim auto-hide top
   *  title bar (Safari-reader style: shown on landing, auto-hides after ~2.5s idle, hides on scroll
   *  down, reveals on scroll up or a tap near the top edge). */
  autoHide?: boolean;
  /** Immersive full-viewport view (Setup-B deck): content column fills the screen and manages its own
   *  scrolling instead of flowing in the normal padded document. */
  flush?: boolean;
  children: ReactNode;
};

const AUTO_HIDE_DELAY_MS = 2500;
// How close to the top edge the pointer must be (px) to reveal an auto-hidden header - roughly the
// header's own 48px height plus a little slack, so tapping/hovering where the header lives brings it
// back, and so a scroll-down within this top strip doesn't hide it before there's anything to read.
const HEADER_REVEAL_ZONE_PX = 64;
// Ignore sub-threshold scroll deltas (iOS momentum/bounce jitter) so the header doesn't flicker.
const SCROLL_DELTA_THRESHOLD_PX = 6;

export function AppShell({
  onNavigateHome,
  onNavigateNewStory,
  pageTitle,
  activeTab,
  autoHide = false,
  flush = false,
  children,
}: AppShellProps) {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = useLayoutMode();
  // The global bottom/rail/sidebar nav shows everywhere except the immersive reader (D1); the reader
  // keeps its own auto-hide top bar (with NavMenu) instead.
  const showNav = !autoHide;

  useEffect(() => {
    // When autoHide is off, the hidden class is ignored below (gated on `autoHide`), so there's
    // nothing to reset here - just skip wiring up the idle timer and scroll/tap listeners.
    if (!autoHide) return;

    // Show + (re)arm the idle timer so a revealed header auto-hides again after a period of stillness.
    function showHeader() {
      setIsHeaderHidden(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsHeaderHidden(true), AUTO_HIDE_DELAY_MS);
    }

    // Hide now and cancel the idle timer - used when the reader scrolls down into the story.
    function hideHeader() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setIsHeaderHidden(true);
    }

    // Directional scroll (Safari-reader style): scrolling down hides immediately, scrolling up
    // reveals. Near the very top there's nothing to read past yet, so a down-scroll there is ignored.
    let lastScrollY = window.scrollY;
    function handleScroll() {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollY;
      if (Math.abs(delta) < SCROLL_DELTA_THRESHOLD_PX) return; // accumulate; don't act on jitter
      if (delta > 0 && currentY > HEADER_REVEAL_ZONE_PX) {
        hideHeader();
      } else if (delta < 0) {
        showHeader();
      }
      lastScrollY = currentY;
    }

    // Tap near the top edge reveals a hidden header; taps down in the story body no longer force it
    // back, so reading stays uninterrupted. Desktop pointer entering the top strip reveals too.
    function handlePointerDown(event: PointerEvent) {
      if (event.clientY <= HEADER_REVEAL_ZONE_PX) showHeader();
    }
    function handlePointerMove(event: PointerEvent) {
      if (event.clientY <= HEADER_REVEAL_ZONE_PX) showHeader();
    }

    showHeader();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [autoHide]);

  return (
    <div
      className={`sk-shell ${fredoka.variable} ${nunito.variable} ${showNav ? `sk-shell-nav sk-shell-${mode}` : ""}`}
    >
      {showNav && (
        <AppNav
          mode={mode}
          activeTab={activeTab}
          onNavigateHome={onNavigateHome}
          onNavigateNewStory={onNavigateNewStory}
        />
      )}
      <div className={`sk-content ${flush ? "sk-content-flush" : ""}`}>
        {autoHide && (
          <header className={`sk-topbar sk-topbar-autohide ${isHeaderHidden ? "sk-topbar-hidden" : ""}`}>
            <NavMenu onNavigateHome={onNavigateHome} onNavigateNewStory={onNavigateNewStory} />
            <span className={`sk-brand-mark ${pageTitle ? "sk-brand-mark-page" : ""}`}>{pageTitle || "Storykins"}</span>
            <span className="sk-icon-btn sk-icon-btn-spacer" aria-hidden="true" />
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

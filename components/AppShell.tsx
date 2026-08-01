"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { fredoka, nunito } from "@/lib/fonts";
import { NavMenu } from "./NavMenu";

type AppShellProps = {
  onNavigateHome: () => void;
  onNavigateNewStory: () => void;
  /** Page-aware center title (e.g. the setup wizard's "New Story" or the reader's story title).
   *  Omit to show the "Storykins" wordmark in brand color. */
  pageTitle?: string;
  /** Auto-hides the header after ~2.5s idle, reappearing on scroll/tap - story reader only. */
  autoHide?: boolean;
  children: ReactNode;
};

const AUTO_HIDE_DELAY_MS = 2500;
// How close to the top edge the pointer must be (px) to reveal an auto-hidden header - roughly the
// header's own 48px height plus a little slack, so moving toward where the header lives brings it back.
const HEADER_REVEAL_ZONE_PX = 64;

export function AppShell({ onNavigateHome, onNavigateNewStory, pageTitle, autoHide = false, children }: AppShellProps) {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When autoHide is off, the hidden class is ignored below (gated on `autoHide`), so there's
    // nothing to reset here - just skip wiring up the idle timer and scroll/tap listeners.
    if (!autoHide) return;

    function showHeader() {
      setIsHeaderHidden(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsHeaderHidden(true), AUTO_HIDE_DELAY_MS);
    }

    // Reveal when the pointer moves into the top strip where the header lives (desktop hover),
    // in addition to scroll/tap - moving away lets the idle timer hide it again.
    function handlePointerMove(event: PointerEvent) {
      if (event.clientY <= HEADER_REVEAL_ZONE_PX) showHeader();
    }

    showHeader();
    window.addEventListener("scroll", showHeader, { passive: true });
    window.addEventListener("pointerdown", showHeader);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("scroll", showHeader);
      window.removeEventListener("pointerdown", showHeader);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [autoHide]);

  return (
    <div className={`sk-shell ${fredoka.variable} ${nunito.variable}`}>
      <div className="sk-content">
        <header className={`sk-topbar ${autoHide ? "sk-topbar-autohide" : ""} ${autoHide && isHeaderHidden ? "sk-topbar-hidden" : ""}`}>
          <NavMenu onNavigateHome={onNavigateHome} onNavigateNewStory={onNavigateNewStory} />
          <span className={`sk-brand-mark ${pageTitle ? "sk-brand-mark-page" : ""}`}>{pageTitle || "Storykins"}</span>
          <span className="sk-icon-btn sk-icon-btn-spacer" aria-hidden="true" />
        </header>
        {children}
      </div>
    </div>
  );
}

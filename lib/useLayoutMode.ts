import { useSyncExternalStore } from "react";

// The V2 responsive model (docs/designs/v2-redesign-decisions.md): one nav/layout system, three
// shapes. Orientation matters independently of width (a short landscape phone wants a side rail even
// though it's "wide"), so this is matchMedia, not width-only Tailwind breakpoints.
//  - tablet    → left sidebar + roomy multi-column content
//  - landscape → 64px left icon rail (short height; a bottom bar would waste ~20% of it — #75)
//  - portrait  → bottom bar + center Create (the baseline)
export type LayoutMode = "portrait" | "landscape" | "tablet";

const TABLET_QUERY = "(min-width: 768px) and (min-height: 600px)";
const LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 600px)";

function compute(): LayoutMode {
  if (typeof window === "undefined" || !window.matchMedia) return "portrait";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  if (window.matchMedia(LANDSCAPE_QUERY).matches) return "landscape";
  return "portrait";
}

function subscribe(callback: () => void) {
  const lists = [window.matchMedia(TABLET_QUERY), window.matchMedia(LANDSCAPE_QUERY)];
  lists.forEach((list) => list.addEventListener("change", callback));
  return () => lists.forEach((list) => list.removeEventListener("change", callback));
}

// compute() returns a stable primitive, so useSyncExternalStore's identity check is satisfied without
// caching. SSR/first paint assume portrait (the smallest shape) and reconcile on mount.
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, compute, () => "portrait");
}

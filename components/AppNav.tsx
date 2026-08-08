"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { LayoutMode } from "@/lib/useLayoutMode";

type AppNavProps = {
  mode: LayoutMode;
  /** Which destination the current view maps to, for the active highlight. */
  activeTab?: "home" | "create";
  onNavigateHome: () => void;
  onNavigateNewStory: () => void;
};

// Sidebar collapsed/open state persists across visits (localStorage now, account later once Supabase
// auth lands - the cross-cutting "persist UI states" note in the V2 plan). Read via
// useSyncExternalStore rather than a useState+effect so server and client agree on the expanded
// default (getServerSnapshot) and there's no setState-in-effect - same pattern as lib/storyHistory.ts.
const SIDEBAR_COLLAPSED_KEY = "storykins:nav-collapsed";
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

function getCollapsedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsedStored(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* storage blocked (private mode / lockdown) - state still updates in-memory for this session */
  }
  collapseListeners.forEach((listener) => listener());
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

function CreateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function FavoritesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 20.3C8 17 4 14 4 9.6 4 7.1 6 5.2 8.4 5.2c1.6 0 2.9.9 3.6 2.1.7-1.2 2-2.1 3.6-2.1C18 5.2 20 7.1 20 9.6c0 4.4-4 7.4-8 10.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 18V6l11-2v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d={collapsed ? "M9 6L15 12L9 18" : "M15 6L9 12L15 18"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  create?: boolean;
  active?: boolean;
  onClick?: () => void; // absent → the destination doesn't exist yet ("Soon", disabled)
};

// One nav model, three shapes (Nav-2, #73/#75). Bottom bar (portrait), 64px icon rail (landscape),
// collapsible left sidebar (tablet). Home + Create are live; Favorites/Music/Settings are shown
// greyed with a "Soon" badge so the roadmap reads at a glance (they don't exist yet). Create owns the
// primary action and, in the bottom bar, sits dead-center as the raised FAB.
export function AppNav({ mode, activeTab, onNavigateHome, onNavigateNewStory }: AppNavProps) {
  const isSidebar = mode === "tablet";
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, () => false);

  function toggleCollapsed() {
    setCollapsedStored(!collapsed);
  }

  // Labels show in the compact shapes (bottom bar / rail) always, and in the sidebar when expanded;
  // only the collapsed sidebar is icon-only. Sidebar labels sit inline; compact labels are the small
  // stacked caption under the icon.
  const showLabel = !(isSidebar && collapsed);
  const labelClass = isSidebar ? "sk-appnav-label" : "sk-appnav-label sk-appnav-label-compact";

  const home: NavItem = { key: "home", label: "Home", icon: <HomeIcon />, active: activeTab === "home", onClick: onNavigateHome };
  const create: NavItem = { key: "create", label: "Create", icon: <CreateIcon />, create: true, active: activeTab === "create", onClick: onNavigateNewStory };
  const favorites: NavItem = { key: "favorites", label: "Favorites", icon: <FavoritesIcon /> };
  const music: NavItem = { key: "music", label: "Music", icon: <MusicIcon /> };
  const settings: NavItem = { key: "settings", label: "Settings", icon: <SettingsIcon /> };

  // Bottom bar centers Create (FAB between two greyed tabs each side); the vertical rail/sidebar keep
  // Create high, right under Home, with the "Soon" items below.
  const items: NavItem[] =
    mode === "portrait"
      ? [home, favorites, create, music, settings]
      : [home, create, favorites, music, settings];

  function renderItem(item: NavItem) {
    const soon = !item.onClick;
    return (
      <button
        key={item.key}
        type="button"
        className={`sk-appnav-item${item.create ? " sk-appnav-create" : ""}${item.active ? " sk-appnav-item-active" : ""}${
          soon ? " sk-appnav-item-soon" : ""
        }`}
        onClick={item.onClick}
        disabled={soon}
        // Always labelled, so the collapsed sidebar (icon-only) still has an accessible name - the SVG
        // icon is aria-hidden. Soon items announce their unavailability.
        aria-label={soon ? `${item.label} (coming soon)` : item.label}
        aria-current={item.active ? "page" : undefined}
      >
        <span className={`sk-appnav-ico${item.create ? " sk-appnav-create-ico" : ""}`}>
          {item.icon}
          {/* Compact shapes: the "Soon" badge overlays the icon, centered on it. */}
          {soon && !isSidebar && <span className="sk-appnav-soon">Soon</span>}
        </span>
        {showLabel && <span className={labelClass}>{item.label}</span>}
        {/* Sidebar: the badge sits inline at the row's end instead. */}
        {soon && isSidebar && <span className="sk-appnav-soon">Soon</span>}
      </button>
    );
  }

  return (
    <nav
      className={`sk-appnav sk-appnav-${mode}${isSidebar && collapsed ? " sk-appnav-collapsed" : ""}`}
      aria-label="Primary"
    >
      {isSidebar && (
        // Collapse control lives INSIDE the sidebar header (the deferred mock fix) so the collapsed
        // rail still shows it as a reopen affordance - no protruding tab floating over the content.
        <div className="sk-appnav-head">
          {!collapsed && <span className="sk-appnav-brand">Storykins</span>}
          <button
            type="button"
            className="sk-appnav-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      )}

      <div className="sk-appnav-items">{items.map(renderItem)}</div>
    </nav>
  );
}

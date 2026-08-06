import { StoryMode } from "@/lib/types";

type StoryModeToggleProps = {
  mode: StoryMode;
  onChange: (mode: StoryMode) => void;
};

// Opt-in switch for interactive mode (#37), styled like the illustration toggle. Off = classic
// one-shot story; on = beat-by-beat with choices.
export function StoryModeToggle({ mode, onChange }: StoryModeToggleProps) {
  const enabled = mode === "interactive";
  return (
    <div className="sk-illus-card">
      <span className="sk-illus-ico" aria-hidden="true">🧭</span>
      <div className="sk-illus-body">
        <span className="sk-illus-title">Make it interactive</span>
        <span className="sk-illus-desc">
          The story unfolds bit by bit — tap to continue or pick what happens next.
          <span className="sk-illus-tag">Off by default</span>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Make it interactive"
        className="sk-switch"
        onClick={() => onChange(enabled ? "classic" : "interactive")}
      >
        <span className="sk-switch-knob" />
      </button>
    </div>
  );
}

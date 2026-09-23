type IllustrationToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** What the switch starts as, so the label can't claim "off by default" after we flip it on. */
  defaultOn: boolean;
};

export function IllustrationToggle({ enabled, onChange, defaultOn }: IllustrationToggleProps) {
  return (
    <div className="sk-illus-card">
      <span className="sk-illus-ico" aria-hidden="true">🎨</span>
      <div className="sk-illus-body">
        <span className="sk-illus-title">Add a cover picture</span>
        <span className="sk-illus-desc">
          One AI illustration for your story&apos;s title page. Takes a few extra seconds.
          <span className="sk-illus-tag">{defaultOn ? "On by default" : "Off by default"}</span>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Add a cover picture"
        className="sk-switch"
        onClick={() => onChange(!enabled)}
      >
        <span className="sk-switch-knob" />
      </button>
    </div>
  );
}

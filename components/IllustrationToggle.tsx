type IllustrationToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function IllustrationToggle({ enabled, onChange }: IllustrationToggleProps) {
  return (
    <div className={`sk-illus-card ${enabled ? "is-on" : ""}`}>
      <span className="sk-illus-ico" aria-hidden="true">🎨</span>
      <div className="sk-illus-body">
        <span className="sk-illus-title">Add a cover picture</span>
        <span className="sk-illus-desc">
          One AI illustration for your story&apos;s title page. Takes a few extra seconds.
          <span className="sk-illus-tag">Off by default</span>
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

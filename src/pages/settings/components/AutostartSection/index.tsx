import "./styles.css";

interface AutostartSectionProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export const AutostartSection = ({ enabled, onChange }: AutostartSectionProps) => {
  return (
    <section className="autostart-section" aria-label="Startup settings">
      <h2 className="autostart-section__title">Startup</h2>
      <label className="autostart-section__row">
        <div className="autostart-section__copy">
          <span className="autostart-section__label">Launch on system startup</span>
          <span className="autostart-section__description">
            Start Quick Doodle automatically when you sign in.
          </span>
        </div>
        <input
          type="checkbox"
          className="autostart-section__toggle"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    </section>
  );
};

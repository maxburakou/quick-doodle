import { type ChangeEvent } from "react";
import { useSettingsStore } from "@/store";
import "./styles.css";

export const AutostartSection = () => {
  const enabled = useSettingsStore((state) => state.draft?.autostart.enabled ?? false);
  const setDraft = useSettingsStore((state) => state.setDraft);
  const handleAutostartChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextEnabled = event.target.checked;

    setDraft((nextDraft) => ({
      ...nextDraft,
      autostart: {
        ...nextDraft.autostart,
        enabled: nextEnabled,
      },
    }));
  };

  return (
    <section className="autostart-section" aria-label="Startup settings">
      <h2 className="autostart-section__title">Startup</h2>
      <label className="autostart-section__row">
        <div className="autostart-section__copy">
          <span className="autostart-section__label">Launch on startup</span>
          <span className="autostart-section__description">
            Start Quick Doodle automatically when you sign in to your Mac.
          </span>
        </div>
        <input
          type="checkbox"
          className="autostart-section__toggle"
          checked={enabled}
          onChange={handleAutostartChange}
        />
      </label>
    </section>
  );
};

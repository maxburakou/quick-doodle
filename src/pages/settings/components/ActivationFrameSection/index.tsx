import { type ChangeEvent } from "react";
import { useSettingsStore } from "@/store";
import "./styles.css";

export const ActivationFrameSection = () => {
  const enabled = useSettingsStore(
    (state) => state.draft?.activation_frame.enabled ?? true
  );
  const setDraft = useSettingsStore((state) => state.setDraft);

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextEnabled = event.target.checked;

    setDraft((nextDraft) => ({
      ...nextDraft,
      activation_frame: {
        ...nextDraft.activation_frame,
        enabled: nextEnabled,
      },
    }));
  };

  return (
    <section className="activation-frame-section" aria-label="Activation frame settings">
      <h2 className="activation-frame-section__title">Activation frame</h2>
      <label className="activation-frame-section__row">
        <div className="activation-frame-section__copy">
          <span className="activation-frame-section__label">Frame visibility</span>
          <span className="activation-frame-section__description">
            Flash a border around the transparent canvas when drawing mode opens.
          </span>
        </div>
        <input
          type="checkbox"
          className="activation-frame-section__toggle"
          checked={enabled}
          onChange={handleEnabledChange}
        />
      </label>
    </section>
  );
};

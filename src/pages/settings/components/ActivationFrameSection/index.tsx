import { useSettingsStore } from "@/store";
import "./styles.css";

const ACTIVATION_FRAME_OPTIONS = [
  { value: true, label: "On" },
  { value: false, label: "Off" },
] as const;

export const ActivationFrameSection = () => {
  const enabled = useSettingsStore(
    (state) => state.draft?.activation_frame.enabled ?? true
  );
  const setDraft = useSettingsStore((state) => state.setDraft);

  const handleEnabledChange = (nextEnabled: boolean) => {
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
      <div className="activation-frame-section__row">
        <div className="activation-frame-section__copy">
          <span className="activation-frame-section__label">Frame visibility</span>
          <span className="activation-frame-section__description">
            Flash a border around the transparent canvas when drawing mode opens.
          </span>
        </div>
        <fieldset
          className="activation-frame-section__radio-group"
          aria-label="Activation frame visibility"
        >
          {ACTIVATION_FRAME_OPTIONS.map((option) => (
            <label className="activation-frame-section__radio-option" key={option.label}>
              <input
                type="radio"
                className="activation-frame-section__radio-control"
                name="activation-frame-enabled"
                value={String(option.value)}
                checked={enabled === option.value}
                onChange={() => handleEnabledChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
};

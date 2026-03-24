import { useSettingsStore } from "@/store";
import type { SettingsSnapshot } from "@/types/settings";
import "./styles.css";

type TrayInactiveClickAction = SettingsSnapshot["tray"]["inactive_click_action"];

const DEFAULT_TRAY_INACTIVE_CLICK_ACTION: TrayInactiveClickAction = "open_previous_canvas";

const TRAY_INACTIVE_CLICK_ACTION_OPTIONS: Array<{
  value: TrayInactiveClickAction;
  label: string;
}> = [
  { value: "open_previous_canvas", label: "Open previous canvas" },
  { value: "open_new_canvas", label: "Open new canvas" },
];

export const TraySection = () => {
  const inactiveClickAction = useSettingsStore(
    (state) => state.draft?.tray.inactive_click_action ?? DEFAULT_TRAY_INACTIVE_CLICK_ACTION
  );
  const setDraft = useSettingsStore((state) => state.setDraft);

  const handleTrayClickActionChange = (nextAction: TrayInactiveClickAction) => {
    setDraft((nextDraft) => ({
      ...nextDraft,
      tray: {
        ...nextDraft.tray,
        inactive_click_action: nextAction,
      },
    }));
  };

  return (
    <section className="tray-section" aria-label="Tray settings">
      <h2 className="tray-section__title">Tray</h2>
      <div className="tray-section__row">
        <div className="tray-section__copy">
          <span className="tray-section__label">Left-click behavior</span>
          <span className="tray-section__description">
            When the canvas is hidden, choose whether tray left-click reopens your previous
            canvas or starts a new one.
          </span>
        </div>
        <fieldset className="tray-section__radio-group" aria-label="Tray click action">
          {TRAY_INACTIVE_CLICK_ACTION_OPTIONS.map((option) => (
            <label className="tray-section__radio-option" key={option.value}>
              <input
                type="radio"
                className="tray-section__radio-control"
                name="tray-click-action"
                value={option.value}
                checked={inactiveClickAction === option.value}
                onChange={() => handleTrayClickActionChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
};

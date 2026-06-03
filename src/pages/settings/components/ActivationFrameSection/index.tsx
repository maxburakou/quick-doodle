import { type ChangeEvent } from "react";
import { useSettingsStore } from "@/store";
import "./styles.css";

export const ActivationFrameSection = () => {
  const enabled = useSettingsStore(
    (state) => state.draft?.activation_frame.enabled ?? true
  );
  const hideWhenCanvasHasDrawing = useSettingsStore(
    (state) => state.draft?.activation_frame.hide_when_canvas_has_drawing ?? true
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

  const handleHideWhenCanvasHasDrawingChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextHideWhenCanvasHasDrawing = event.target.checked;

    setDraft((nextDraft) => ({
      ...nextDraft,
      activation_frame: {
        ...nextDraft.activation_frame,
        hide_when_canvas_has_drawing: nextHideWhenCanvasHasDrawing,
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
      <label
        className={`activation-frame-section__row ${enabled ? "" : "activation-frame-section__row--disabled"}`}
      >
        <div className="activation-frame-section__copy">
          <span className="activation-frame-section__label">Hide on non-empty canvas</span>
          <span className="activation-frame-section__description">
            Skip the activation frame if the canvas already contains strokes.
          </span>
        </div>
        <input
          type="checkbox"
          className="activation-frame-section__toggle"
          checked={hideWhenCanvasHasDrawing}
          disabled={!enabled}
          onChange={handleHideWhenCanvasHasDrawingChange}
        />
      </label>
    </section>
  );
};

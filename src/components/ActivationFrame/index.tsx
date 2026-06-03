import { useEffect, useRef } from "react";
import { useCanvasBackground, usePresent, useSettingsStore } from "@/store";
import { CanvasBackground } from "@/types";
import "./styles.css";

interface ActivationFrameProps {
  isAppVisible: boolean;
}

export const ActivationFrame: React.FC<ActivationFrameProps> = ({
  isAppVisible,
}) => {
  const canvasBackground = useCanvasBackground();
  const hasCanvasDrawing = usePresent().length > 0;
  const hasCanvasBeenDrawnOnWhileVisibleRef = useRef(false);
  const isActivationFrameEnabled = useSettingsStore(
    (state) => state.snapshot?.activation_frame.enabled ?? true
  );
  const hideWhenCanvasHasDrawing = useSettingsStore(
    (state) => state.snapshot?.activation_frame.hide_when_canvas_has_drawing ?? false
  );

  useEffect(() => {
    if (!isAppVisible) {
      hasCanvasBeenDrawnOnWhileVisibleRef.current = false;
      return;
    }

    if (hasCanvasDrawing) {
      hasCanvasBeenDrawnOnWhileVisibleRef.current = true;
    }
  }, [hasCanvasDrawing, isAppVisible]);

  const shouldHideForCanvasDrawing =
    hideWhenCanvasHasDrawing &&
    (hasCanvasDrawing || hasCanvasBeenDrawnOnWhileVisibleRef.current);

  if (
    !isActivationFrameEnabled ||
    !isAppVisible ||
    canvasBackground !== CanvasBackground.Transparent ||
    shouldHideForCanvasDrawing
  ) {
    return null;
  }

  return <div className="activation-frame" aria-hidden />;
};

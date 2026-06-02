import { useCanvasBackground, useSettingsStore } from "@/store";
import { CanvasBackground } from "@/types";
import "./styles.css";

interface ActivationFrameProps {
  isAppVisible: boolean;
}

export const ActivationFrame: React.FC<ActivationFrameProps> = ({
  isAppVisible,
}) => {
  const canvasBackground = useCanvasBackground();
  const isActivationFrameEnabled = useSettingsStore(
    (state) => state.snapshot?.activation_frame.enabled ?? true
  );

  if (
    !isActivationFrameEnabled ||
    !isAppVisible ||
    canvasBackground !== CanvasBackground.Transparent
  ) {
    return null;
  }

  return <div className="activation-frame" aria-hidden />;
};

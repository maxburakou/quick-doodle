import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { useToolbarFillContext } from "../../hooks/useToolbarFillContext";
import "./styles.css";

export const FillOptions = () => {
  const { contextShapeFill } = useToolbarFillContext();
  const { setShapeFill } = useSelectionSettingsActions();

  return (
    <button
      onClick={() => setShapeFill(!contextShapeFill)}
      className={`options-button fill-button ${contextShapeFill ? "--active" : ""}`}
      aria-pressed={contextShapeFill}
      aria-label="Toggle shape fill"
    >
      F
    </button>
  );
};

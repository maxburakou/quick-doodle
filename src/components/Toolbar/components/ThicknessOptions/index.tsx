import { useToolThicknesses } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { Minus } from "lucide-react";
import { useToolbarThicknessContext } from "../../hooks/useToolbarThicknessContext";

export const ThicknessOptions = () => {
  const { contextThickness } = useToolbarThicknessContext();
  const thicknesses = useToolThicknesses();
  const { setThickness } = useSelectionSettingsActions();

  return (
    <>
      {thicknesses.map((thickness, index) => (
        <button
          key={index}
          onClick={() => setThickness(thickness)}
          className={`options-button thickness-button ${
            thickness === contextThickness ? "--active" : ""
          }`}
        >
          <Minus size={16} strokeWidth={thickness} />
        </button>
      ))}
    </>
  );
};

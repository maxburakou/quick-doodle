import { DEFAULT_STROKE_WIDTH as thicknesses } from "@/config";
import { useToolSettingsStore } from "@/store";
import { Minus } from "lucide-react";

export const ThicknessOptions = () => {
  const { thickness: selectedThickness, setThickness } = useToolSettingsStore();
  return (
    <>
      {thicknesses.map((thickness) => (
        <button
          key={thickness}
          onClick={() => setThickness(thickness)}
          className={`options-button thickness-button ${
            thickness === selectedThickness ? "--active" : ""
          }`}
        >
          <Minus size={16} strokeWidth={thickness} />
        </button>
      ))}
    </>
  );
};

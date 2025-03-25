import {
  useSetToolThickness,
  useToolThickness,
  useToolThicknesses,
} from "@/store";
import { Minus } from "lucide-react";

export const ThicknessOptions = () => {
  const selectedThickness = useToolThickness();
  const thicknesses = useToolThicknesses();
  const setThickness = useSetToolThickness();

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

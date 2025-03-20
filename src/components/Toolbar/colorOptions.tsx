import { DEFAULT_STROKE_COLORS as colors } from "@/config";
import { useToolSettingsStore } from "@/store";
import { Settings } from "lucide-react";

export const ColorOptions = () => {
  const { color: selectedColor, setColor } = useToolSettingsStore();
  return (
    <>
      {colors.map((color, index) => (
        <button
          key={index}
          onClick={() => setColor(color)}
          className={`options-button color-button ${
            color === selectedColor ? "--active" : ""
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
      <Settings className="settings-button" size={16} />
    </>
  );
};

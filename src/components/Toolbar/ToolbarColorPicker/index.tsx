import { HexColorPicker } from "react-colorful";
import "../styles.css";
import { useToolColor, useUpdateToolColor } from "@/store";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export const ToolbarColorPicker: React.FC = () => {
  const color = useToolColor();
  const updateColor = useUpdateToolColor();
  const [tempColor, setTempColor] = useState(color);
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(tempColor);

  const debouncedUpdateColor = useDebouncedCallback((newColor: string) => {
    updateColor(newColor);
  }, 300);

  const handleColorChange = (newColor: string) => {
    setTempColor(newColor);
    debouncedUpdateColor(newColor);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempColor(value);

    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      debouncedUpdateColor(value);
    }
  };

  return (
    <section className="color-picker">
      <HexColorPicker color={tempColor} onChange={handleColorChange} />
      <input
        type="text"
        value={tempColor}
        onChange={handleInputChange}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className={`hex-input ${!isValid ? "--invalid" : ""}`}
        maxLength={7}
      />
    </section>
  );
};

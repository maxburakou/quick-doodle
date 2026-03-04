import { HexColorPicker } from "react-colorful";
import "./styles.css";
import { useToolColor } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useToolbarColorContext } from "../../hooks/useToolbarColorContext";

export const ToolbarColorPicker: React.FC = () => {
  const storeColor = useToolColor();
  const { contextColor, selectionColorSource } = useToolbarColorContext();
  const isMixedGroupColor =
    selectionColorSource === "group-selection" && contextColor === null;
  const { updateColor, setColor } = useSelectionSettingsActions();
  const [tempColor, setTempColor] = useState(
    isMixedGroupColor ? "" : contextColor ?? storeColor
  );
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(tempColor);
  const pickerColor = isValid ? tempColor : storeColor;

  const applyColor = (newColor: string) => {
    if (isMixedGroupColor) {
      setColor(newColor);
      return;
    }

    updateColor(newColor);
  };

  const debouncedUpdateColor = useDebouncedCallback((newColor: string) => {
    applyColor(newColor);
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
    <section className={`color-picker ${isMixedGroupColor ? "--mixed" : ""}`}>
      <HexColorPicker color={pickerColor} onChange={handleColorChange} />
      <input
        type="text"
        value={tempColor}
        placeholder="Hex Color"
        onChange={handleInputChange}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className={`hex-input ${!isValid ? "--invalid" : ""}`}
        maxLength={7}
      />
    </section>
  );
};

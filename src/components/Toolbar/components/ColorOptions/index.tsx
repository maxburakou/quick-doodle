import { Popover } from "@/components";
import { useToolColor, useToolColors } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { useToolbarColorContext } from "../../hooks/useToolbarColorContext";
import { ToolbarColorPicker } from "../ToolbarColorPicker";

export const ColorOptions = () => {
  const { contextColor } = useToolbarColorContext();
  const storeColor = useToolColor();
  const colors = useToolColors();
  const { setColor } = useSelectionSettingsActions();

  return (
    <>
      {colors.map((color, index) => (
        <button
          key={index}
          onClick={() => setColor(color)}
          className={`options-button color-button ${
            color === contextColor ? "--active" : ""
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
      <Popover content={<ToolbarColorPicker />}>
        <button
          className="custom-color-button"
          style={{ backgroundColor: contextColor ?? storeColor }}
          aria-label="Custom color"
        />
      </Popover>
    </>
  );
};

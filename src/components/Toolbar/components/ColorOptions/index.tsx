import { Popover } from "@/components";
import { useToolColor, useToolColors } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { useToolbarColorContext } from "../../hooks/useToolbarColorContext";
import { ToolbarColorPicker } from "../ToolbarColorPicker";

export const ColorOptions = () => {
  const { contextColor, selectionColorSource } = useToolbarColorContext();
  const storeColor = useToolColor();
  const colors = useToolColors();
  const { setColor } = useSelectionSettingsActions();
  const isMixedGroupColor =
    selectionColorSource === "group-selection" && contextColor === null;
  const isCustomContextColor =
    contextColor !== null && !colors.includes(contextColor);
  const isCustomButtonActive = isMixedGroupColor || isCustomContextColor;

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
          className={`options-button custom-color-button ${
            isMixedGroupColor ? "--mixed" : ""
          } ${isCustomButtonActive ? "--active" : ""}`.trim()}
          style={
            isMixedGroupColor ? undefined : { backgroundColor: contextColor ?? storeColor }
          }
          aria-label="Custom color"
        />
      </Popover>
    </>
  );
};

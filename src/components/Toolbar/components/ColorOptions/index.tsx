import { Popover } from "@/components";
import { useSetToolColor, useToolColors } from "@/store";
import { useToolbarColorContext } from "../../hooks/useToolbarColorContext";
import { ToolbarColorPicker } from "../ToolbarColorPicker";

export const ColorOptions = () => {
  const { contextColor } = useToolbarColorContext();
  const colors = useToolColors();
  const setColor = useSetToolColor();

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
          style={{ backgroundColor: contextColor }}
          aria-label="Custom color"
        />
      </Popover>
    </>
  );
};

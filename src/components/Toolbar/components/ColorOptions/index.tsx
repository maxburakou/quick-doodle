import { Popover } from "@/components";
import { useSetToolColor, useToolColor, useToolColors } from "@/store";
import { Settings } from "lucide-react";
import { ToolbarColorPicker } from "../ToolbarColorPicker";

export const ColorOptions = () => {
  const selectedColor = useToolColor();
  const colors = useToolColors();
  const setColor = useSetToolColor();

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
      <Popover content={<ToolbarColorPicker />}>
        <Settings className="settings-button" size={16} />
      </Popover>
    </>
  );
};

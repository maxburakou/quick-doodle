import { useToolSettingsStore } from "@/store";
import { Settings } from "lucide-react";
import { Popover } from "../Popover";
import { ToolbarColorPicker } from "./ToolbarColorPicker";

export const ColorOptions = () => {
  const { color: selectedColor, setColor, colors } = useToolSettingsStore();

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

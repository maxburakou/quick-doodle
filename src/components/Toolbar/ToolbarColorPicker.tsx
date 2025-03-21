import { HexColorPicker } from "react-colorful";
import "./styles.css";
import { useToolSettingsStore } from "@/store";

export const ToolbarColorPicker: React.FC = () => {
  const { color, updateColor } = useToolSettingsStore();
  return (
    <section className="color-picker">
      <HexColorPicker color={color} onChange={updateColor} />
    </section>
  );
};

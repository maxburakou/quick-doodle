import { Popover } from "@/components";
import { useFontSize, useFontSizes, useSetFontSize } from "@/store";
import { getFontSizeLabel } from "./helpers";
import { ToolbarFontSizePicker } from "../ToolbarFontSizePicker";
import { Settings } from "lucide-react";

export const FontSizeOptions = () => {
  const selectedFontSize = useFontSize();
  const fontSizes = useFontSizes();
  const setFontSize = useSetFontSize();

  return (
    <>
      {fontSizes.map((fontSize, index) => (
        <button
          key={index}
          onClick={() => setFontSize(fontSize)}
          className={`options-button fontsize-button ${
            fontSize === selectedFontSize ? "--active" : ""
          }`}
        >
          {getFontSizeLabel(index)}
        </button>
      ))}
      <Popover content={<ToolbarFontSizePicker />}>
        <Settings className="settings-button" size={16} />
      </Popover>
    </>
  );
};

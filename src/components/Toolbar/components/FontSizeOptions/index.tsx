//import { Popover } from "@/components";
import { useFontSizes } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { getFontSizeLabel } from "./helpers";
import { useToolbarFontSizeContext } from "../../hooks/useToolbarFontSizeContext";
//import { ToolbarFontSizePicker } from "../ToolbarFontSizePicker";
//import { Settings } from "lucide-react";

export const FontSizeOptions = () => {
  const { contextFontSize } = useToolbarFontSizeContext();
  const fontSizes = useFontSizes();
  const { setFontSize } = useSelectionSettingsActions();

  return (
    <>
      {fontSizes.map((fontSize, index) => (
        <button
          key={index}
          onClick={() => setFontSize(fontSize)}
          className={`options-button fontsize-button ${
            fontSize === contextFontSize ? "--active" : ""
          }`}
        >
          {getFontSizeLabel(index)}
        </button>
      ))}
      {/* ToDo: Think about size picker for font size, maybe add it to the right of the buttons */}
      {/* <Popover content={<ToolbarFontSizePicker />}>
        <Settings className="settings-button" size={16} />
      </Popover> */}
    </>
  );
};

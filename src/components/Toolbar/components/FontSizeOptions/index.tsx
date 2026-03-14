import { useFontSizes } from "@/store";
import { useSelectionSettingsActions } from "@/components/Canvas/hooks/useSelectionSettingsActions";
import { getFontSizeLabel } from "./helpers";
import { useToolbarFontSizeContext } from "../../hooks/useToolbarFontSizeContext";
import "./styles.css";

export const FontSizeOptions = () => {
  const { contextFontSize } = useToolbarFontSizeContext();
  const fontSizes = useFontSizes();
  const { setFontSize } = useSelectionSettingsActions();

  return (
    <>
      {fontSizes.map((fontSize, index) => (
        <button
          key={index}
          type="button"
          onClick={() => setFontSize(fontSize)}
          className={`options-button fontsize-button ${
            fontSize === contextFontSize ? "--active" : ""
          }`}
        >
          {getFontSizeLabel(index)}
        </button>
      ))}
    </>
  );
};

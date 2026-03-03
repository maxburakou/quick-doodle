import { useFontSize } from "@/store";
import { Tool } from "@/types";
import { resolveContextFontSize } from "@/components/Canvas/helpers/selectionSettings";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionFontSizeSource = "store" | "single-selection";

export const useToolbarFontSizeContext = (): {
  contextFontSize: number;
  selectionFontSizeSource: SelectionFontSizeSource;
} => {
  const storeFontSize = useFontSize();
  const selectedStroke = useSingleSelectedStroke();
  const contextFontSize = resolveContextFontSize(storeFontSize, selectedStroke);

  if (selectedStroke && selectedStroke.tool === Tool.Text) {
    return { contextFontSize, selectionFontSizeSource: "single-selection" };
  }

  return {
    contextFontSize,
    selectionFontSizeSource: "store",
  };
};

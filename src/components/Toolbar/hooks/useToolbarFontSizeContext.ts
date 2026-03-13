import { useFontSize } from "@/store";
import { Tool } from "@/types";
import {
  resolveContextFontSize,
  resolveGroupFontSizeContext,
} from "@/components/Canvas/helpers/selectionSettings";
import { useSelectedStrokes } from "@/components/Canvas/hooks/useSelectedStrokes";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionFontSizeSource = "store" | "single-selection" | "group-selection";

export const useToolbarFontSizeContext = (): {
  contextFontSize: number | null;
  selectionFontSizeSource: SelectionFontSizeSource;
} => {
  const storeFontSize = useFontSize();
  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokes = useSelectedStrokes();

  if (selectedStrokes.length > 1) {
    return {
      contextFontSize: resolveGroupFontSizeContext(selectedStrokes),
      selectionFontSizeSource: "group-selection",
    };
  }

  const contextFontSize = resolveContextFontSize(storeFontSize, selectedStroke);

  if (selectedStroke && selectedStroke.tool === Tool.Text) {
    return { contextFontSize, selectionFontSizeSource: "single-selection" };
  }

  return {
    contextFontSize,
    selectionFontSizeSource: "store",
  };
};

import { useToolThickness } from "@/store";
import { Tool } from "@/types";
import {
  resolveContextThickness,
  resolveGroupThicknessContext,
} from "@/components/Canvas/helpers/selectionSettings";
import { useSelectedStrokes } from "@/components/Canvas/hooks/useSelectedStrokes";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionThicknessSource = "store" | "single-selection" | "group-selection";

export const useToolbarThicknessContext = (): {
  contextThickness: number | null;
  selectionThicknessSource: SelectionThicknessSource;
} => {
  const storeThickness = useToolThickness();
  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokes = useSelectedStrokes();

  if (selectedStrokes.length > 1) {
    return {
      contextThickness: resolveGroupThicknessContext(selectedStrokes),
      selectionThicknessSource: "group-selection",
    };
  }

  const contextThickness = resolveContextThickness(storeThickness, selectedStroke);

  if (selectedStroke && selectedStroke.tool !== Tool.Text) {
    return { contextThickness, selectionThicknessSource: "single-selection" };
  }

  return {
    contextThickness,
    selectionThicknessSource: "store",
  };
};

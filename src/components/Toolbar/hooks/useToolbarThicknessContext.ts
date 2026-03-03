import { useToolThickness } from "@/store";
import { Tool } from "@/types";
import { resolveContextThickness } from "@/components/Canvas/helpers/selectionSettings";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionThicknessSource = "store" | "single-selection";

export const useToolbarThicknessContext = (): {
  contextThickness: number;
  selectionThicknessSource: SelectionThicknessSource;
} => {
  const storeThickness = useToolThickness();
  const selectedStroke = useSingleSelectedStroke();
  const contextThickness = resolveContextThickness(storeThickness, selectedStroke);

  if (selectedStroke && selectedStroke.tool !== Tool.Text) {
    return { contextThickness, selectionThicknessSource: "single-selection" };
  }

  return {
    contextThickness,
    selectionThicknessSource: "store",
  };
};

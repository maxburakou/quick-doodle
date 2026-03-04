import { useToolColor } from "@/store";
import {
  resolveContextColor,
  resolveGroupColorContext,
} from "@/components/Canvas/helpers/selectionSettings";
import { useSelectedStrokes } from "@/components/Canvas/hooks/useSelectedStrokes";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionColorSource = "store" | "single-selection" | "group-selection";

export const useToolbarColorContext = (): {
  contextColor: string | null;
  selectionColorSource: SelectionColorSource;
} => {
  const storeColor = useToolColor();
  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokes = useSelectedStrokes();

  if (selectedStrokes.length > 1) {
    return {
      contextColor: resolveGroupColorContext(selectedStrokes),
      selectionColorSource: "group-selection",
    };
  }

  const contextColor = resolveContextColor(storeColor, selectedStroke);

  if (selectedStroke) {
    return { contextColor, selectionColorSource: "single-selection" };
  }

  return {
    contextColor,
    selectionColorSource: "store",
  };
};

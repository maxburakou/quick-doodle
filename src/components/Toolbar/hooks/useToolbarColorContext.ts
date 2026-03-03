import { useToolColor } from "@/store";
import { resolveContextColor } from "@/components/Canvas/helpers/selectionSettings";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

type SelectionColorSource = "store" | "single-selection";

export const useToolbarColorContext = (): {
  contextColor: string;
  selectionColorSource: SelectionColorSource;
} => {
  const storeColor = useToolColor();
  const selectedStroke = useSingleSelectedStroke();
  const contextColor = resolveContextColor(storeColor, selectedStroke);

  if (selectedStroke) {
    return { contextColor, selectionColorSource: "single-selection" };
  }

  return {
    contextColor,
    selectionColorSource: "store",
  };
};

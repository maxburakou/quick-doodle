import { useToolShapeFill } from "@/store";
import { isFillableShapeTool } from "@/types";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

export const useToolbarFillContext = (): {
  contextShapeFill: boolean;
} => {
  const storeShapeFill = useToolShapeFill();
  const selectedStroke = useSingleSelectedStroke();

  if (selectedStroke && isFillableShapeTool(selectedStroke.tool)) {
    return { contextShapeFill: Boolean(selectedStroke.shapeFill) };
  }

  return { contextShapeFill: storeShapeFill };
};

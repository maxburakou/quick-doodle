import { useToolShapeFill } from "@/store";
import { isFillableShapeTool } from "@/types";
import { resolveGroupShapeFillContext } from "@/components/Canvas/helpers/selectionSettings";
import { useSelectedStrokes } from "@/components/Canvas/hooks/useSelectedStrokes";
import { useSingleSelectedStroke } from "@/components/Canvas/hooks/useSingleSelectedStroke";

export const useToolbarFillContext = (): {
  contextShapeFill: boolean;
} => {
  const storeShapeFill = useToolShapeFill();
  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokes = useSelectedStrokes();

  if (selectedStroke && isFillableShapeTool(selectedStroke.tool)) {
    return { contextShapeFill: Boolean(selectedStroke.shapeFill) };
  }

  const groupShapeFill = resolveGroupShapeFillContext(selectedStrokes);
  if (groupShapeFill !== null) {
    return { contextShapeFill: groupShapeFill };
  }

  return { contextShapeFill: storeShapeFill };
};

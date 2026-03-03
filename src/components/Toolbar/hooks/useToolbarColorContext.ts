import {
  usePresent,
  useShapeEditorStore,
  useTool,
  useToolColor,
} from "@/store";
import { Tool } from "@/types";
import { useShallow } from "zustand/react/shallow";

type SelectionColorSource = "store" | "single-selection";

export const useToolbarColorContext = (): {
  contextColor: string;
  selectionColorSource: SelectionColorSource;
} => {
  const activeTool = useTool();
  const present = usePresent();
  const storeColor = useToolColor();
  const { selectedStrokeIds, primarySelectedStrokeId } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId: state.primarySelectedStrokeId,
    }))
  );

  if (activeTool === Tool.Select && selectedStrokeIds.length === 1) {
    const targetId = primarySelectedStrokeId ?? selectedStrokeIds[0];
    const selectedStroke = present.find((stroke) => stroke.id === targetId);
    if (selectedStroke) {
      return {
        contextColor: selectedStroke.color,
        selectionColorSource: "single-selection",
      };
    }
  }

  return {
    contextColor: storeColor,
    selectionColorSource: "store",
  };
};

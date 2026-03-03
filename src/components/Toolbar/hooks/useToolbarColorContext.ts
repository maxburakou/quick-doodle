import {
  usePresent,
  useShapeEditorStore,
  useTool,
  useToolColor,
} from "@/store";
import { useShallow } from "zustand/react/shallow";
import {
  resolveContextColor,
  getSingleSelectedStroke,
} from "../services/selectionSettingsService";

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

  const selectedStroke = getSingleSelectedStroke({
    activeTool,
    selectedStrokeIds,
    primarySelectedStrokeId,
    present,
  });
  const contextColor = resolveContextColor(storeColor, selectedStroke);

  if (selectedStroke) {
    return { contextColor, selectionColorSource: "single-selection" };
  }

  return {
    contextColor,
    selectionColorSource: "store",
  };
};

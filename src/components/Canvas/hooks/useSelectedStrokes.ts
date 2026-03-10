import { usePresent, useShapeEditorStore, useTool } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { getSelectedStrokes } from "../helpers/selectionSettings";

export const useSelectedStrokes = () => {
  const activeTool = useTool();
  const present = usePresent();
  const { selectedStrokeIds } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
    })),
  );

  return getSelectedStrokes({
    activeTool,
    selectedStrokeIds,
    present,
  });
};

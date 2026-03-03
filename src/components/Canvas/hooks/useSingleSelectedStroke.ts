import { usePresent, useShapeEditorStore, useTool } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { getSingleSelectedStroke } from "../helpers/selectionSettings";

export const useSingleSelectedStroke = () => {
  const activeTool = useTool();
  const present = usePresent();
  const { selectedStrokeIds, primarySelectedStrokeId } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId: state.primarySelectedStrokeId,
    }))
  );

  return getSingleSelectedStroke({
    activeTool,
    selectedStrokeIds,
    primarySelectedStrokeId,
    present,
  });
};

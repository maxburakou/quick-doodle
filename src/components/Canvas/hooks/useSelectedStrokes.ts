import { useShapeEditorStore, useTool } from "@/store";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useShallow } from "zustand/react/shallow";
import { getSelectedStrokes } from "../helpers/selectionSettings";
import { useMemo } from "react";
import { Tool } from "@/types";

export const useSelectedStrokes = () => {
  const activeTool = useTool();
  const { selectedStrokeIds } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
    })),
  );

  return useMemo(() => {
    if (activeTool !== Tool.Select || selectedStrokeIds.length === 0) return [];
    
    const { present } = useHistoryStore.getState();
    return getSelectedStrokes({
      activeTool,
      selectedStrokeIds,
      present,
    });
  }, [activeTool, selectedStrokeIds]);
};

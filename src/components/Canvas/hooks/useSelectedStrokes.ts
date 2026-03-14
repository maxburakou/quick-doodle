import { useShapeEditorStore, useTool } from "@/store";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useShallow } from "zustand/react/shallow";
import { useMemo } from "react";
import { Stroke, Tool } from "@/types";

const EMPTY_SELECTED_STROKES: Stroke[] = [];

export const useSelectedStrokes = () => {
  const activeTool = useTool();
  const { selectedStrokeIds } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
    })),
  );

  const selectedStrokeIdSet = useMemo(
    () => new Set(selectedStrokeIds),
    [selectedStrokeIds],
  );

  return useHistoryStore(
    useShallow(({ present }) => {
      if (activeTool !== Tool.Select || selectedStrokeIdSet.size === 0) {
        return EMPTY_SELECTED_STROKES;
      }

      const selectedStrokes = present.filter((stroke) =>
        selectedStrokeIdSet.has(stroke.id),
      );
      return selectedStrokes.length === 0 ? EMPTY_SELECTED_STROKES : selectedStrokes;
    }),
  );
};

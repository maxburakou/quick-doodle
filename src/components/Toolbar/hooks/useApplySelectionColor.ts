import {
  useHistoryStore,
  useSetToolColor,
  useShapeEditorStore,
  useTool,
  useToolColor,
} from "@/store";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  applyColorToStroke,
  getSingleSelectedStroke,
} from "../services/selectionSettingsService";

export const useApplySelectionColor = () => {
  const activeTool = useTool();
  const storeColor = useToolColor();
  const setToolColor = useSetToolColor();
  const lastSyncedTargetIdRef = useRef<string | null>(null);
  const { present, commitPresent } = useHistoryStore(
    useShallow((state) => ({
      present: state.present,
      commitPresent: state.commitPresent,
    }))
  );
  const { selectedStrokeIds, primarySelectedStrokeId, session } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId: state.primarySelectedStrokeId,
      session: state.session,
    }))
  );

  useEffect(() => {
    const selectedStroke = getSingleSelectedStroke({
      activeTool,
      selectedStrokeIds,
      primarySelectedStrokeId,
      present,
    });

    if (!selectedStroke) {
      lastSyncedTargetIdRef.current = null;
      return;
    }

    if (lastSyncedTargetIdRef.current !== selectedStroke.id) {
      lastSyncedTargetIdRef.current = selectedStroke.id;
      if (storeColor !== selectedStroke.color) {
        setToolColor(selectedStroke.color);
      }
      return;
    }

    const nextPresent = applyColorToStroke({
      present,
      strokeId: selectedStroke.id,
      color: storeColor,
      isTransforming: Boolean(session),
    });

    if (nextPresent) {
      commitPresent(nextPresent);
    }
  }, [
    activeTool,
    commitPresent,
    present,
    primarySelectedStrokeId,
    selectedStrokeIds,
    session,
    setToolColor,
    storeColor,
  ]);
};

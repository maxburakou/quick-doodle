import {
  useFontSize,
  useHistoryStore,
  useSetFontSize,
  useSetToolColor,
  useSetToolThickness,
  useShapeEditorStore,
  useTool,
  useToolColor,
  useToolThickness,
} from "@/store";
import { Tool } from "@/types";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { applySingleSelectionSettings } from "../helpers/selectionSettings";
import { useSingleSelectedStroke } from "./useSingleSelectedStroke";

export const useSelectionSettingsController = () => {
  const activeTool = useTool();
  const storeColor = useToolColor();
  const storeThickness = useToolThickness();
  const storeFontSize = useFontSize();

  const setToolColor = useSetToolColor();
  const setToolThickness = useSetToolThickness();
  const setFontSize = useSetFontSize();

  const selectedStroke = useSingleSelectedStroke();
  const selectedStrokeId = selectedStroke?.id ?? null;
  const selectedStrokeTool = selectedStroke?.tool ?? null;
  const selectedStrokeColor = selectedStroke?.color ?? null;
  const selectedStrokeThickness = selectedStroke?.thickness ?? null;
  const selectedStrokeFontSize = selectedStroke?.text?.fontSize ?? null;
  const lastSyncedTargetIdRef = useRef<string | null>(null);
  const lastAppliedSignatureRef = useRef<string | null>(null);
  const { commitPresent } = useHistoryStore(
    useShallow((state) => ({
      commitPresent: state.commitPresent,
    }))
  );
  const { session } = useShapeEditorStore(
    useShallow((state) => ({
      session: state.session,
    }))
  );

  useEffect(() => {
    if (!selectedStroke) {
      lastSyncedTargetIdRef.current = null;
      lastAppliedSignatureRef.current = null;
      return;
    }

    const targetChanged = lastSyncedTargetIdRef.current !== selectedStroke.id;
    lastSyncedTargetIdRef.current = selectedStroke.id;
    if (targetChanged) {
      lastAppliedSignatureRef.current = null;
    }

    if (storeColor !== selectedStroke.color) {
      setToolColor(selectedStroke.color);
    }

    if (selectedStroke.tool === Tool.Text && selectedStroke.text) {
      if (storeFontSize !== selectedStroke.text.fontSize) {
        setFontSize(selectedStroke.text.fontSize);
      }
      return;
    }

    if (storeThickness !== selectedStroke.thickness) {
      setToolThickness(selectedStroke.thickness);
    }
  }, [
    selectedStrokeId,
    selectedStrokeTool,
    selectedStrokeColor,
    selectedStrokeThickness,
    selectedStrokeFontSize,
    setFontSize,
    setToolColor,
    setToolThickness,
  ]);

  useEffect(() => {
    if (!selectedStroke || activeTool !== Tool.Select || session) {
      return;
    }

    const applySignature = `${selectedStroke.id}:${storeColor}:${storeThickness}:${storeFontSize}`;
    if (lastAppliedSignatureRef.current === applySignature) {
      return;
    }
    lastAppliedSignatureRef.current = applySignature;

    const currentPresent = useHistoryStore.getState().present;

    const nextPresent = applySingleSelectionSettings({
      present: currentPresent,
      selectedStroke,
      storeColor,
      storeThickness,
      storeFontSize,
      isTransforming: false,
    });

    if (nextPresent) {
      commitPresent(nextPresent);
    }
  }, [
    activeTool,
    commitPresent,
    session,
    selectedStrokeId,
    selectedStrokeTool,
    storeColor,
    storeFontSize,
    storeThickness,
  ]);
};

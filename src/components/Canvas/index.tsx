import React, { useCallback, useRef } from "react";
import { Tool } from "@/types";
import {
  useHistoryStore,
  useShapeEditorStore,
  useStartTextEditorEdit,
  useToolSettingsStore,
  useToolStore,
} from "@/store";
import { useShallow } from "zustand/react/shallow";
import {
  useCanvasScaleSetup,
  useDrawMode,
  usePointerEvents,
  useSelectionSettingsController,
  useSelectMode,
  useShortcuts,
} from "./hooks";
import { CanvasPointerPayload } from "./hooks/types";
import "./styles.css";
import { BackgroundCanvas } from "./BackgroundCanvas";

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { color, thickness, shapeFill } = useToolSettingsStore(
    useShallow((state) => ({
      color: state.color,
      thickness: state.thickness,
      shapeFill: state.shapeFill,
    }))
  );
  const tool = useToolStore((state) => state.tool);
  const { addAction, present, commitPresent } = useHistoryStore(
    useShallow((state) => ({
      addAction: state.addAction,
      present: state.present,
      commitPresent: state.commitPresent,
    }))
  );
  const {
    selectedStrokeIds,
    primarySelectedStrokeId,
    session,
    setSelection,
    toggleSelection,
    startTransform,
    startGroupMove,
    updateTransform,
    updateGroupMove,
    commitTransform,
    commitGroupMove,
    clearSelection,
  } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId: state.primarySelectedStrokeId,
      session: state.session,
      setSelection: state.setSelection,
      toggleSelection: state.toggleSelection,
      startTransform: state.startTransform,
      startGroupMove: state.startGroupMove,
      updateTransform: state.updateTransform,
      updateGroupMove: state.updateGroupMove,
      commitTransform: state.commitTransform,
      commitGroupMove: state.commitGroupMove,
      clearSelection: state.clearSelection,
    }))
  );
  const startTextEdit = useStartTextEditorEdit();

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);
  useSelectionSettingsController();

  const drawMode = useDrawMode({
    ctxRef,
    present,
    color,
    thickness,
    shapeFill,
    tool,
    addAction,
  });

  const selectMode = useSelectMode({
    tool,
    ctxRef,
    present,
    selectedStrokeIds,
    primarySelectedStrokeId,
    session,
    clearSelection,
    setSelection,
    toggleSelection,
    startTransform,
    startGroupMove,
    updateTransform,
    updateGroupMove,
    commitTransform,
    commitGroupMove,
    commitPresent,
    startTextEdit,
  });
  const {
    cursor: selectCursor,
    handlePointerLeave: handleSelectPointerLeave,
  } = selectMode;

  const activeMode = tool === Tool.Select ? selectMode : drawMode;

  const canvasCursor: React.CSSProperties["cursor"] =
    tool === Tool.Select ? selectCursor : tool === Tool.Text ? "text" : "crosshair";

  const getPointerPayloadFromEvent = (
    e?: React.PointerEvent<HTMLCanvasElement>
  ): CanvasPointerPayload => ({
    point: {
      x: e?.nativeEvent.offsetX ?? 0,
      y: e?.nativeEvent.offsetY ?? 0,
      pressure: e?.pressure ?? 0.5,
    },
    shiftKey: e?.shiftKey ?? false,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activeMode.handlePointerDown(getPointerPayloadFromEvent(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activeMode.handlePointerMove(getPointerPayloadFromEvent(e));
  };

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      activeMode.handlePointerUp?.(getPointerPayloadFromEvent(e));
    },
    [activeMode]
  );

  usePointerEvents(handlePointerUp);

  return (
    <section className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className={`drawing-canvas ${tool === Tool.Select ? "--select" : ""}`}
        style={{ cursor: canvasCursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handleSelectPointerLeave}
      />
      <BackgroundCanvas />
    </section>
  );
};

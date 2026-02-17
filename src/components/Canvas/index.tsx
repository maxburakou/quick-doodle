import React, { useCallback, useRef } from "react";
import { Tool } from "@/types";
import {
  useHistoryStore,
  useShapeEditorStore,
  useToolSettingsStore,
  useToolStore,
} from "@/store";
import { useShallow } from "zustand/react/shallow";
import {
  useCanvasScaleSetup,
  useDrawMode,
  usePointerEvents,
  useSelectMode,
  useShortcuts,
} from "./hooks";
import { CanvasPointerPayload } from "./hooks/types";
import "./styles.css";
import { BackgroundCanvas } from "./BackgroundCanvas";

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { color, thickness } = useToolSettingsStore(
    useShallow((state) => ({
      color: state.color,
      thickness: state.thickness,
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
    selectedStrokeId,
    session,
    selectStroke,
    startTransform,
    updateTransform,
    commitTransform,
    clearSelection,
  } = useShapeEditorStore(
    useShallow((state) => ({
      selectedStrokeId: state.selectedStrokeId,
      session: state.session,
      selectStroke: state.selectStroke,
      startTransform: state.startTransform,
      updateTransform: state.updateTransform,
      commitTransform: state.commitTransform,
      clearSelection: state.clearSelection,
    }))
  );

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);

  const drawMode = useDrawMode({
    ctxRef,
    color,
    thickness,
    tool,
    addAction,
  });
  const {
    handlePointerDown: handleDrawPointerDown,
    handlePointerMove: handleDrawPointerMove,
    handlePointerUp: handleDrawPointerUp,
  } = drawMode;

  const selectMode = useSelectMode({
    tool,
    ctxRef,
    present,
    selectedStrokeId,
    session,
    clearSelection,
    selectStroke,
    startTransform,
    updateTransform,
    commitTransform,
    commitPresent,
  });
  const {
    cursor: selectCursor,
    handlePointerDown: handleSelectPointerDown,
    handlePointerMove: handleSelectPointerMove,
    handlePointerUp: handleSelectPointerUp,
    handlePointerLeave: handleSelectPointerLeave,
  } = selectMode;

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
    const payload = getPointerPayloadFromEvent(e);

    if (tool === Tool.Select) {
      handleSelectPointerDown(payload);
      return;
    }

    handleDrawPointerDown(payload);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const payload = getPointerPayloadFromEvent(e);

    if (tool === Tool.Select) {
      handleSelectPointerMove(payload);
      return;
    }

    handleDrawPointerMove(payload);
  };

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === Tool.Select) {
        handleSelectPointerUp(getPointerPayloadFromEvent(e));
        return;
      }

      handleDrawPointerUp(getPointerPayloadFromEvent(e));
    },
    [tool, handleSelectPointerUp, handleDrawPointerUp]
  );

  usePointerEvents(handlePointerUp);

  return (
    <section className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className={`drawing-canvas ${tool === Tool.Select ? "--select" : ""}`}
        style={tool === Tool.Select ? { cursor: selectCursor } : undefined}
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

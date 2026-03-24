import React, { useCallback, useRef } from "react";
import { Tool } from "@/types";
import { useToolStore } from "@/store";
import {
  useCanvasScaleSetup,
  useDrawMode,
  useMarqueeOverlayController,
  usePointerEvents,
  useSelectionSettingsController,
  useSelectMode,
  useShortcuts,
} from "./hooks";
import { CanvasPointerPayload } from "./hooks/types";
import "./styles.css";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { MarqueeOverlay } from "./MarqueeOverlay";

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

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const tool = useToolStore((state) => state.tool);
  const marqueeOverlay = useMarqueeOverlayController();

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);
  useSelectionSettingsController();

  const drawMode = useDrawMode({ ctxRef });
  const selectMode = useSelectMode({ ctxRef, marqueeOverlay: marqueeOverlay.overlayApi });

  const {
    cursor: selectCursor,
    handlePointerLeave: handleSelectPointerLeave,
  } = selectMode;

  const activeModeRef = useRef(tool === Tool.Select ? selectMode : drawMode);
  activeModeRef.current = tool === Tool.Select ? selectMode : drawMode;

  const canvasCursor: React.CSSProperties["cursor"] =
    tool === Tool.Select ? selectCursor : tool === Tool.Text ? "text" : "crosshair";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activeModeRef.current.handlePointerDown(getPointerPayloadFromEvent(e));
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activeModeRef.current.handlePointerMove(getPointerPayloadFromEvent(e));
    },
    []
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      activeModeRef.current.handlePointerUp?.(getPointerPayloadFromEvent(e));
    },
    []
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
      <MarqueeOverlay
        isVisible={tool === Tool.Select}
        bounds={marqueeOverlay.bounds}
        isActive={marqueeOverlay.isActive}
      />
    </section>
  );
};

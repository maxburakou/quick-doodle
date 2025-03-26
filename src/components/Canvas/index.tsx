import React, { useCallback, useRef } from "react";
import { Stroke, StrokePoint } from "@/types";
import { useAddRecord, useTool, useToolColor, useToolThickness } from "@/store";
import { useCanvasScaleSetup, usePointerEvents, useShortcuts } from "./hooks";
import { clearCanvas, drawCanvas } from "./helpers";
import "./styles.css";
import { BackgroundCanvas } from "./BackgroundCanvas";

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const pointsRef = useRef<StrokePoint[]>([]);
  const setPoints = (points: StrokePoint[]) => (pointsRef.current = points);
  const addPoints = (point: StrokePoint) => pointsRef.current.push(point);

  const isDrawingRef = useRef(false);
  const startDrawing = () => (isDrawingRef.current = true);
  const stopDrawing = () => (isDrawingRef.current = false);

  const drawableSeed = useRef<number>(Date.now());
  const updateDrawableSeed = () => (drawableSeed.current = Date.now());

  const color = useToolColor();
  const thickness = useToolThickness();
  const tool = useTool();
  const addAction = useAddRecord();

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    startDrawing();
    updateDrawableSeed();

    const points: StrokePoint[] = [
      {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
        pressure: e.pressure,
      },
    ];
    const stroke: Stroke = {
      points,
      color,
      thickness,
      tool,
      drawableSeed: drawableSeed.current,
    };

    setPoints(points);
    drawCanvas([stroke], ctxRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const isShiftPressed = e.shiftKey;

    const point: StrokePoint = {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
      pressure: e.pressure,
    };

    const stroke: Stroke = {
      points: pointsRef.current,
      color,
      thickness,
      tool,
      drawableSeed: drawableSeed.current,
      isShiftPressed,
    };

    addPoints(point);
    drawCanvas([stroke], ctxRef.current);
  };

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;

      stopDrawing();

      const isShiftPressed = e?.shiftKey;

      const stroke: Stroke = {
        points: pointsRef.current,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeed.current,
        isShiftPressed,
      };

      addAction(stroke);
      setPoints([]);

      clearCanvas(ctxRef.current);
    },
    [addAction, color, thickness, tool]
  );

  usePointerEvents(handlePointerUp);

  return (
    <section className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <BackgroundCanvas />
    </section>
  );
};

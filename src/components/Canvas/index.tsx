import React, { useCallback, useRef } from "react";
import { Stroke, StrokePoint } from "../../types";
import { useHistoryStore, useSettingsStore, useToolStore } from "../../store";
import { useCanvasScaleSetup, usePointerEvents, useShortcuts } from "./hooks";
import { clearCanvas, drawCanvas } from "./helpers";
import { BackgroundCanvas } from "./backgroundCanvas";
import "./styles.css";

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

  // const rafIdRef = useRef<number | null>(null);

  const { color, thickness } = useSettingsStore();
  const { tool } = useToolStore();
  const { addAction } = useHistoryStore();

  useShortcuts();
  useCanvasScaleSetup(canvasRef, ctxRef);

  // const updateCanvas = () => {
  //   if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  //   rafIdRef.current = requestAnimationFrame(() => {
  //     const stroke: Stroke = {
  //       points: pointsRef.current,
  //       color,
  //       thickness,
  //       tool,
  //     };
  //     drawCanvas([stroke], ctxRef.current);
  //   });
  // };

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
    };

    addPoints(point);
    drawCanvas([stroke], ctxRef.current);
    // updateCanvas();
  };

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;

    stopDrawing();
    // if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    const stroke: Stroke = {
      points: pointsRef.current,
      color,
      thickness,
      tool,
      drawableSeed: drawableSeed.current,
    };

    addAction(stroke);
    setPoints([]);

    clearCanvas(ctxRef.current);
  }, [addAction, color, thickness, tool]);

  usePointerEvents(handlePointerUp);

  return (
    <section className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <BackgroundCanvas />
    </section>
  );
};

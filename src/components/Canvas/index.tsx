import React, { useRef } from "react";
import { Toolbar } from "../Toolbar";
import { Stroke, StrokePoint } from "../../types";
import { useHistoryStore, useSettingsStore, useToolStore } from "../../store";
import { useCanvasScaleSetup, useShortcuts } from "./hooks";
import { clearCanvas, drawCanvas, getDrawable } from "./helpers";
import { BackgroundCanvas } from "./backgroundCanvas";
import "./styles.css";

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const pointsRef = useRef<StrokePoint[]>([]);
  const setPoints = (points: StrokePoint[]) => (pointsRef.current = points);
  const addPoints = (point: StrokePoint) => pointsRef.current.push(point);

  const isDrawingRef = useRef(false);
  const toggleDrawing = () => (isDrawingRef.current = !isDrawingRef.current);

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
    toggleDrawing();

    const points: StrokePoint[] = [
      {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
        pressure: e.pressure,
      },
    ];
    const stroke: Stroke = { points, color, thickness, tool };

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
      tool
    };

    addPoints(point);
    drawCanvas([stroke], ctxRef.current);
    // updateCanvas();
  };

  const handlePointerUp = () => {
    toggleDrawing();
    // if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    const drawable = getDrawable(
      tool,
      pointsRef.current[0],
      pointsRef.current[pointsRef.current.length - 1],
      {
        stroke: color,
        strokeWidth: thickness / 1.5,
        roughness: 1,
        bowing: 0.5,
      }
    );

    const stroke: Stroke = {
      points: pointsRef.current,
      color,
      thickness,
      tool,
      drawable,
    };

    addAction(stroke);
    setPoints([]);

    clearCanvas(ctxRef.current);
  };

  return (
    <section className="canvas-wrapper">
      <Toolbar />
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

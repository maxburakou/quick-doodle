import { memo, useEffect, useRef } from "react";
import { useCanvasScaleSetup } from "./hooks";
import { drawCanvas } from "./helpers";
import { useCanvasStore, useHistoryStore } from "@/store";
import "./styles.css";

const Canvas = () => {
  const { background } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { present } = useHistoryStore();
  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(present, ctxRef.current);
  }, [present]);

  return (
    <canvas
      className="background-canvas"
      ref={canvasRef}
      style={{ background }}
    />
  );
};

export const BackgroundCanvas = memo(Canvas);

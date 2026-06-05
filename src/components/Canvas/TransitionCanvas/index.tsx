import { memo, useEffect, useRef } from "react";
import { useSmartAssistStore } from "@/features/smartAssist";
import { drawCanvas } from "../helpers";
import { useCanvasScaleSetup } from "../hooks";
import "./styles.css";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const transition = useSmartAssistStore((state) => state.transition);

  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(transition?.toStrokes ?? [], ctxRef.current);
  }, [transition]);

  return <canvas className="transition-canvas" ref={canvasRef} />;
};

export const TransitionCanvas = memo(Canvas);

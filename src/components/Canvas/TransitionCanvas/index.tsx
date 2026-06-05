import { memo, useEffect, useMemo, useRef } from "react";
import { useSmartAssistStore } from "@/features/smartAssist";
import { drawCanvas } from "../helpers";
import { useCanvasScaleSetup } from "../hooks";
import "./styles.css";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const batch = useSmartAssistStore((state) => state.batch);
  const transition = useSmartAssistStore((state) => state.transition);
  const renderStrokes = useMemo(
    () => transition?.toStrokes ?? batch?.strokes ?? [],
    [batch, transition]
  );

  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(renderStrokes, ctxRef.current);
  }, [renderStrokes]);

  return <canvas className="transition-canvas" ref={canvasRef} />;
};

export const TransitionCanvas = memo(Canvas);

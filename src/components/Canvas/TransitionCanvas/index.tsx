import { memo, useRef } from "react";
import { useCanvasScaleSetup } from "../hooks";
import { useTransitionCanvasAnimation } from "./hooks";
import "./styles.css";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useCanvasScaleSetup(canvasRef, ctxRef);
  useTransitionCanvasAnimation(ctxRef);

  return <canvas className="transition-canvas" ref={canvasRef} />;
};

export const TransitionCanvas = memo(Canvas);

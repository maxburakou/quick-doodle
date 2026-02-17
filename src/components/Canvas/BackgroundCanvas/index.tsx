import { memo, useEffect, useMemo, useRef } from "react";
import { useCanvasScaleSetup } from "../hooks";
import { drawCanvas } from "../helpers";
import {
  useCanvasBackground,
  usePresent,
  useShapeTransformSession,
} from "@/store";
import { buildPreviewStrokes } from "@/store/useShapeEditorStore/helpers";
import "./styles.css";

const Canvas = () => {
  const background = useCanvasBackground();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const present = usePresent();
  const session = useShapeTransformSession();
  const renderStrokes = useMemo(
    () => buildPreviewStrokes(present, session),
    [present, session]
  );
  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(renderStrokes, ctxRef.current);
  }, [renderStrokes]);

  return (
    <canvas
      className="background-canvas"
      ref={canvasRef}
      style={{ background }}
    />
  );
};

export const BackgroundCanvas = memo(Canvas);

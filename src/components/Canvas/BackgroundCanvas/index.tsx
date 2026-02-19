import { memo, useEffect, useMemo, useRef } from "react";
import { useCanvasScaleSetup } from "../hooks";
import { drawCanvas } from "../helpers";
import {
  useCanvasBackground,
  usePresent,
  useShapeTransformSession,
  useTextEditorEditingStrokeId,
  useTextEditorMode,
} from "@/store";
import { buildPreviewStrokes } from "@/store/useShapeEditorStore/helpers";
import { Tool } from "@/types";
import "./styles.css";

const Canvas = () => {
  const background = useCanvasBackground();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const present = usePresent();
  const session = useShapeTransformSession();
  const textEditorMode = useTextEditorMode();
  const editingStrokeId = useTextEditorEditingStrokeId();
  const renderStrokes = useMemo(
    () => {
      const previewStrokes = buildPreviewStrokes(present, session);

      if (textEditorMode !== "edit" || !editingStrokeId) {
        return previewStrokes;
      }

      return previewStrokes.filter(
        (stroke) =>
          !(stroke.id === editingStrokeId && stroke.tool === Tool.Text)
      );
    },
    [present, session, textEditorMode, editingStrokeId]
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

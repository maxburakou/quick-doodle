import { memo, useEffect, useMemo, useRef } from "react";
import { useCanvasScaleSetup } from "../hooks";
import { drawCanvas } from "../helpers";
import {
  useCanvasBackground,
  usePresent,
  useShapeEditorStore,
  useTextEditorEditingStrokeId,
  useTextEditorMode,
} from "@/store";
import { CanvasBackground } from "@/types";
import { getRenderLayers } from "../utils";
import { useShallow } from "zustand/react/shallow";
import "./styles.css";

const Canvas = () => {
  const background = useCanvasBackground();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const present = usePresent();
  const activeStrokeIds = useShapeEditorStore(
    useShallow((state) => {
      const session = state.session;
      if (!session) return [];
      return session.type === "single" ? [session.strokeId] : session.strokeIds;
    })
  );
  const textEditorMode = useTextEditorMode();
  const editingStrokeId = useTextEditorEditingStrokeId();
  const renderStrokes = useMemo(
    () => {
      const { staticStrokes } = getRenderLayers({
        present,
        activeStrokeIds,
        textEditorMode,
        editingStrokeId,
      });
      return staticStrokes;
    },
    [present, activeStrokeIds, textEditorMode, editingStrokeId]
  );
  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(renderStrokes, ctxRef.current);
  }, [renderStrokes]);

  return (
    <canvas
      className={`background-canvas ${
        background === CanvasBackground.Light ? "--light" : "--transparent"
      }`}
      ref={canvasRef}
    />
  );
};

export const BackgroundCanvas = memo(Canvas);

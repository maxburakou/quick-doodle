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
import { useThemeStore } from "@/store/useThemeStore";
import { CanvasBackground } from "@/types";
import { getRenderLayers } from "../utils";
import "./styles.css";

const Canvas = () => {
  const background = useCanvasBackground();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);

  const present = usePresent();
  const activeStrokeIdsStr = useShapeEditorStore((state) => {
    const session = state.session;
    if (!session) return "";
    return session.type === "single"
      ? session.strokeId
      : session.strokeIds.join(",");
  });

  const activeStrokeIds = useMemo(
    () => (activeStrokeIdsStr ? activeStrokeIdsStr.split(",") : []),
    [activeStrokeIdsStr]
  );

  const textEditorMode = useTextEditorMode();
  const editingStrokeId = useTextEditorEditingStrokeId();
  const renderStrokes = useMemo(() => {
    const { staticStrokes } = getRenderLayers({
      present,
      activeStrokeIds,
      textEditorMode,
      editingStrokeId,
    });
    return staticStrokes;
  }, [present, activeStrokeIds, textEditorMode, editingStrokeId]);

  useCanvasScaleSetup(canvasRef, ctxRef);

  useEffect(() => {
    drawCanvas(renderStrokes, ctxRef.current);
  }, [renderStrokes, effectiveTheme]);

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

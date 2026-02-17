import { useCallback, useMemo, useRef } from "react";
import { Stroke, StrokePoint, Tool } from "@/types";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { clearCanvas, drawCanvas, finalizeStrokePoints } from "../helpers";
import { CanvasPointerPayload } from "./types";

interface UseDrawModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  color: string;
  thickness: number;
  tool: Tool;
  addAction: (stroke: Stroke) => void;
}

export const useDrawMode = ({
  ctxRef,
  color,
  thickness,
  tool,
  addAction,
}: UseDrawModeParams) => {
  const pointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const drawableSeedRef = useRef<number>(Date.now());
  const strokeIdRef = useRef<string>("");

  const startDrawing = () => {
    isDrawingRef.current = true;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handlePointerDown = useCallback(
    ({ point }: CanvasPointerPayload) => {
      startDrawing();
      drawableSeedRef.current = Date.now();
      strokeIdRef.current = createStrokeId();

      pointsRef.current = [point];

      const stroke: Stroke = {
        id: strokeIdRef.current,
        points: pointsRef.current,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
      };

      drawCanvas([stroke], ctxRef.current);
    },
    [color, thickness, tool, ctxRef]
  );

  const handlePointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;

      const stroke: Stroke = {
        id: strokeIdRef.current,
        points: pointsRef.current,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
        isShiftPressed: shiftKey,
      };

      pointsRef.current.push(point);
      drawCanvas([stroke], ctxRef.current);
    },
    [color, thickness, tool, ctxRef]
  );

  const handlePointerUp = useCallback(
    ({ shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;

      stopDrawing();

      const finalizedPoints = finalizeStrokePoints(
        pointsRef.current,
        tool,
        shiftKey
      );

      const stroke: Stroke = {
        id: strokeIdRef.current || createStrokeId(),
        points: finalizedPoints,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
      };

      addAction(stroke);
      pointsRef.current = [];
      strokeIdRef.current = "";
      clearCanvas(ctxRef.current);
    },
    [addAction, color, thickness, tool, ctxRef]
  );

  return useMemo(
    () => ({
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp]
  );
};

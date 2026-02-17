import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stroke, StrokePoint, Tool, TransformHandle, TransformSession } from "@/types";
import {
  clearCanvas,
  drawShapeEditorOverlay,
  getCursorByHandle,
  resolveSelectCursor,
  resolveSelectTarget,
} from "../helpers";
import { CanvasPointerPayload } from "./types";

interface UseSelectModeParams {
  tool: Tool;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  present: Stroke[];
  selectedStrokeId: string | null;
  session: TransformSession | null;
  clearSelection: () => void;
  selectStroke: (id: string | null) => void;
  startTransform: (params: {
    stroke: Stroke;
    handle: TransformHandle;
    pointer: StrokePoint;
  }) => void;
  updateTransform: (pointer: StrokePoint, options?: { shiftKey?: boolean }) => void;
  commitTransform: (
    present: Stroke[],
    commitPresent: (nextPresent: Stroke[]) => void
  ) => void;
  commitPresent: (nextPresent: Stroke[]) => void;
}

export const useSelectMode = ({
  tool,
  ctxRef,
  present,
  selectedStrokeId,
  session,
  clearSelection,
  selectStroke,
  startTransform,
  updateTransform,
  commitTransform,
  commitPresent,
}: UseSelectModeParams) => {
  const prevToolRef = useRef<Tool>(tool);
  const [cursor, setCursor] = useState<React.CSSProperties["cursor"]>("move");
  const selectedStroke = useMemo(
    () => present.find((stroke) => stroke.id === selectedStrokeId) ?? null,
    [present, selectedStrokeId]
  );

  const handlePointerDown = useCallback(
    ({ point }: CanvasPointerPayload) => {
      const targetResult = resolveSelectTarget(point, present, selectedStroke);

      if (!targetResult.selectedStroke || !targetResult.nextHandle) {
        clearSelection();
        clearCanvas(ctxRef.current);
        setCursor("move");
        return;
      }

      const { selectedStroke: targetStroke, nextHandle } = targetResult;
      selectStroke(targetStroke.id);
      startTransform({ stroke: targetStroke, handle: nextHandle, pointer: point });
      setCursor(nextHandle === "move" ? "grabbing" : getCursorByHandle(nextHandle));
    },
    [
      present,
      selectedStroke,
      clearSelection,
      ctxRef,
      selectStroke,
      startTransform,
    ]
  );

  const handlePointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (session) {
        updateTransform(point, { shiftKey });
        setCursor(
          session.handle === "move" ? "grabbing" : getCursorByHandle(session.handle)
        );
        return;
      }

      setCursor(resolveSelectCursor(point, present, selectedStroke));
    },
    [session, updateTransform, present, selectedStroke]
  );

  const handlePointerUp = useCallback((_payload: CanvasPointerPayload) => {
    if (!session) return;
    commitTransform(present, commitPresent);
  }, [session, commitTransform, present, commitPresent]);

  const handlePointerLeave = useCallback(() => {
    if (!session) {
      setCursor("move");
    }
  }, [session]);

  useEffect(() => {
    const prevTool = prevToolRef.current;
    const switchedFromSelect = prevTool === Tool.Select && tool !== Tool.Select;

    if (switchedFromSelect) {
      if (session) {
        commitTransform(present, commitPresent);
      }
      clearSelection();
      clearCanvas(ctxRef.current);
      setCursor("move");
    }

    prevToolRef.current = tool;
  }, [tool, session, present, commitTransform, commitPresent, clearSelection, ctxRef]);

  useEffect(() => {
    if (tool !== Tool.Select) {
      clearCanvas(ctxRef.current);
      return;
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    const activeStroke = session?.draftStroke ?? selectedStroke;

    clearCanvas(ctx);
    if (!activeStroke) return;

    drawShapeEditorOverlay(ctx, activeStroke);
  }, [tool, selectedStroke, session, ctxRef]);

  useEffect(() => {
    if (!selectedStrokeId) return;

    const hasSelectedStroke = present.some((stroke) => stroke.id === selectedStrokeId);
    if (!hasSelectedStroke) {
      clearSelection();
      clearCanvas(ctxRef.current);
    }
  }, [present, selectedStrokeId, clearSelection, ctxRef]);

  return useMemo(
    () => ({
      cursor,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    }),
    [cursor, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave]
  );
};

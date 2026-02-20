import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeBounds,
  ShapeEditorSession,
  Stroke,
  StrokePoint,
  Tool,
  TransformHandle,
} from "@/types";
import { useTextEditorMode } from "@/store";
import {
  clearCanvas,
  drawGroupSelectionOverlay,
  drawMarqueeOverlay,
  drawShapeEditorOverlay,
  getCursorByHandle,
  resolveSelectCursor,
  resolveSelectTarget,
} from "../helpers";
import { CanvasPointerPayload } from "./types";
import { normalizeTextStroke } from "../utils/textGeometry";
import { getStrokeAABB } from "@/store/useShapeEditorStore/helpers";

const TEXT_EDIT_SECOND_CLICK_INTERVAL_MS = 400;
const MARQUEE_DRAG_THRESHOLD = 3;

interface UseSelectModeParams {
  tool: Tool;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  present: Stroke[];
  selectedStrokeIds: string[];
  primarySelectedStrokeId: string | null;
  session: ShapeEditorSession | null;
  clearSelection: () => void;
  setSelection: (ids: string[], primaryId?: string | null) => void;
  toggleSelection: (id: string) => void;
  startTransform: (params: {
    stroke: Stroke;
    handle: TransformHandle;
    pointer: StrokePoint;
  }) => void;
  startGroupMove: (params: { strokes: Stroke[]; pointer: StrokePoint }) => void;
  updateTransform: (pointer: StrokePoint, options?: { shiftKey?: boolean }) => void;
  updateGroupMove: (pointer: StrokePoint) => void;
  commitTransform: (
    present: Stroke[],
    commitPresent: (nextPresent: Stroke[]) => void
  ) => void;
  commitGroupMove: (
    present: Stroke[],
    commitPresent: (nextPresent: Stroke[]) => void
  ) => void;
  commitPresent: (nextPresent: Stroke[]) => void;
  startTextEdit: (params: {
    strokeId: string;
    text: string;
    startPoint: StrokePoint;
    fontSize: number;
  }) => void;
}

const normalizeMarqueeBounds = (
  start: StrokePoint,
  current: StrokePoint
): ShapeBounds => ({
  x: Math.min(start.x, current.x),
  y: Math.min(start.y, current.y),
  width: Math.abs(current.x - start.x),
  height: Math.abs(current.y - start.y),
});

const intersects = (a: ShapeBounds, b: ShapeBounds) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

const getStrokesInMarquee = (strokes: Stroke[], marqueeBounds: ShapeBounds) =>
  strokes
    .filter((stroke) => intersects(getStrokeAABB(stroke), marqueeBounds))
    .map((stroke) => stroke.id);

export const useSelectMode = ({
  tool,
  ctxRef,
  present,
  selectedStrokeIds,
  primarySelectedStrokeId,
  session,
  clearSelection,
  setSelection,
  toggleSelection,
  startTransform,
  startGroupMove,
  updateTransform,
  updateGroupMove,
  commitTransform,
  commitGroupMove,
  commitPresent,
  startTextEdit,
}: UseSelectModeParams) => {
  const prevToolRef = useRef<Tool>(tool);
  const lastTextBodyClickRef = useRef<{ strokeId: string; at: number } | null>(null);
  const marqueeStartRef = useRef<StrokePoint | null>(null);
  const marqueeShiftRef = useRef(false);
  const marqueeActiveRef = useRef(false);
  const [marqueeBounds, setMarqueeBounds] = useState<ShapeBounds | null>(null);
  const [cursor, setCursor] = useState<React.CSSProperties["cursor"]>("default");
  const textEditorMode = useTextEditorMode();

  const selectedStrokes = useMemo(
    () =>
      present.filter((stroke) => selectedStrokeIds.includes(stroke.id)),
    [present, selectedStrokeIds]
  );
  const primarySelectedStroke = useMemo(
    () =>
      present.find((stroke) => stroke.id === primarySelectedStrokeId) ?? null,
    [present, primarySelectedStrokeId]
  );

  const finalizeMarquee = useCallback(
    (pointer: StrokePoint) => {
      const start = marqueeStartRef.current;
      if (!start) return;

      const shouldApplyMarquee = marqueeActiveRef.current;
      if (!shouldApplyMarquee) {
        if (!marqueeShiftRef.current) {
          clearSelection();
        }
      } else {
        const bounds = normalizeMarqueeBounds(start, pointer);
        const hitIds = getStrokesInMarquee(present, bounds);
        if (marqueeShiftRef.current) {
          const nextSelection = Array.from(new Set([...selectedStrokeIds, ...hitIds]));
          setSelection(nextSelection, nextSelection[nextSelection.length - 1] ?? null);
        } else {
          setSelection(hitIds, hitIds[hitIds.length - 1] ?? null);
        }
      }

      marqueeStartRef.current = null;
      marqueeActiveRef.current = false;
      marqueeShiftRef.current = false;
      setMarqueeBounds(null);
    },
    [clearSelection, present, selectedStrokeIds, setSelection]
  );

  const handlePointerDown = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      const startMarqueeSelection = () => {
        marqueeStartRef.current = point;
        marqueeShiftRef.current = shiftKey;
        marqueeActiveRef.current = false;
        setMarqueeBounds(null);
        setCursor("default");
      };

      const targetResult = resolveSelectTarget(
        point,
        present,
        selectedStrokes,
        primarySelectedStroke
      );

      if (!targetResult.targetStroke || !targetResult.nextHandle) {
        lastTextBodyClickRef.current = null;
        startMarqueeSelection();
        return;
      }

      const { targetStroke, nextHandle, targetKind, isBodyHit } = targetResult;
      if (shiftKey) {
        if (!isBodyHit) {
          startMarqueeSelection();
          return;
        }
        toggleSelection(targetStroke.id);
        setCursor("default");
        return;
      }

      const isSingleTextBodyClick =
        selectedStrokes.length === 1 &&
        primarySelectedStroke?.id === targetStroke.id &&
        targetKind === "single-selected" &&
        isBodyHit &&
        targetStroke.tool === Tool.Text &&
        nextHandle === "move" &&
        Boolean(targetStroke.text);

      if (isSingleTextBodyClick) {
        const now = Date.now();
        const lastClick = lastTextBodyClickRef.current;
        const canEnterTextEdit =
          lastClick?.strokeId === targetStroke.id &&
          now - lastClick.at <= TEXT_EDIT_SECOND_CLICK_INTERVAL_MS;

        lastTextBodyClickRef.current = { strokeId: targetStroke.id, at: now };

        if (canEnterTextEdit) {
          const normalizedTextStroke = normalizeTextStroke(targetStroke);
          const normalizedText = normalizedTextStroke.text ?? targetStroke.text!;
          const startPoint = normalizedTextStroke.points[0] ?? {
            x: 0,
            y: 0,
            pressure: 0.5,
          };

          startTextEdit({
            strokeId: normalizedTextStroke.id,
            text: normalizedText.value,
            startPoint,
            fontSize: normalizedText.fontSize,
          });
          setCursor("default");
          return;
        }
      } else {
        lastTextBodyClickRef.current = null;
      }

      if (selectedStrokes.length > 1 && targetKind === "selected-group-member") {
        startGroupMove({ strokes: selectedStrokes, pointer: point });
        setCursor("grabbing");
        return;
      }

      setSelection([targetStroke.id], targetStroke.id);
      startTransform({ stroke: targetStroke, handle: nextHandle, pointer: point });
      setCursor(nextHandle === "move" ? "grabbing" : getCursorByHandle(nextHandle));
    },
    [
      present,
      primarySelectedStroke,
      selectedStrokes,
      setSelection,
      startGroupMove,
      startTextEdit,
      startTransform,
      toggleSelection,
    ]
  );

  const handlePointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (marqueeStartRef.current) {
        const start = marqueeStartRef.current;
        const dx = Math.abs(point.x - start.x);
        const dy = Math.abs(point.y - start.y);
        if (!marqueeActiveRef.current && (dx > MARQUEE_DRAG_THRESHOLD || dy > MARQUEE_DRAG_THRESHOLD)) {
          marqueeActiveRef.current = true;
        }

        if (marqueeActiveRef.current) {
          setMarqueeBounds(normalizeMarqueeBounds(start, point));
          setCursor("crosshair");
        }
        return;
      }

      if (session?.type === "single") {
        updateTransform(point, { shiftKey });
        setCursor(
          session.handle === "move" ? "grabbing" : getCursorByHandle(session.handle)
        );
        return;
      }

      if (session?.type === "groupMove") {
        updateGroupMove(point);
        setCursor("grabbing");
        return;
      }

      setCursor(resolveSelectCursor(point, present, selectedStrokes, primarySelectedStroke));
    },
    [
      present,
      primarySelectedStroke,
      selectedStrokes,
      session,
      updateTransform,
      updateGroupMove,
    ]
  );

  const handlePointerUp = useCallback(
    ({ point }: CanvasPointerPayload) => {
      if (marqueeStartRef.current) {
        finalizeMarquee(point);
        return;
      }

      if (!session) return;
      if (session.type === "single") {
        commitTransform(present, commitPresent);
        return;
      }

      commitGroupMove(present, commitPresent);
    },
    [
      commitGroupMove,
      commitPresent,
      commitTransform,
      finalizeMarquee,
      present,
      session,
    ]
  );

  const handlePointerLeave = useCallback(() => {
    if (!session && !marqueeStartRef.current) {
      setCursor("default");
    }
  }, [session]);

  useEffect(() => {
    const prevTool = prevToolRef.current;
    const switchedFromSelect = prevTool === Tool.Select && tool !== Tool.Select;

    if (switchedFromSelect) {
      if (session?.type === "single") {
        commitTransform(present, commitPresent);
      } else if (session?.type === "groupMove") {
        commitGroupMove(present, commitPresent);
      }

      clearSelection();
      marqueeStartRef.current = null;
      marqueeActiveRef.current = false;
      marqueeShiftRef.current = false;
      setMarqueeBounds(null);
      clearCanvas(ctxRef.current);
      setCursor("default");
    }

    prevToolRef.current = tool;
  }, [
    clearSelection,
    commitGroupMove,
    commitPresent,
    commitTransform,
    ctxRef,
    present,
    session,
    tool,
  ]);

  useEffect(() => {
    if (textEditorMode === "edit") {
      clearCanvas(ctxRef.current);
      return;
    }

    if (tool !== Tool.Select) {
      clearCanvas(ctxRef.current);
      return;
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    clearCanvas(ctx);

    if (session?.type === "single") {
      drawShapeEditorOverlay(ctx, session.draftStroke);
    } else if (session?.type === "groupMove") {
      const draftStrokes = session.strokeIds
        .map((id) => session.draftStrokesById[id])
        .filter(Boolean);
      drawGroupSelectionOverlay(ctx, draftStrokes);
    } else if (selectedStrokes.length > 1) {
      drawGroupSelectionOverlay(ctx, selectedStrokes);
    } else if (primarySelectedStroke) {
      drawShapeEditorOverlay(ctx, primarySelectedStroke);
    }

    if (marqueeBounds) {
      drawMarqueeOverlay(ctx, marqueeBounds);
    }
  }, [
    ctxRef,
    marqueeBounds,
    primarySelectedStroke,
    selectedStrokes,
    session,
    textEditorMode,
    tool,
  ]);

  useEffect(() => {
    if (selectedStrokeIds.length === 0) return;

    const existingIds = new Set(present.map((stroke) => stroke.id));
    const nextSelection = selectedStrokeIds.filter((id) => existingIds.has(id));

    if (nextSelection.length === selectedStrokeIds.length) return;

    if (nextSelection.length === 0) {
      clearSelection();
      clearCanvas(ctxRef.current);
      return;
    }

    const nextPrimary = nextSelection.includes(primarySelectedStrokeId ?? "")
      ? primarySelectedStrokeId
      : nextSelection[nextSelection.length - 1];
    setSelection(nextSelection, nextPrimary);
  }, [
    clearSelection,
    ctxRef,
    present,
    primarySelectedStrokeId,
    selectedStrokeIds,
    setSelection,
  ]);

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

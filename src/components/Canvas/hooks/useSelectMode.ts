import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeBounds,
  ShapeEditorSession,
  Stroke,
  StrokePoint,
  Tool,
  TransformHandle,
} from "@/types";
import {
  useSnapStore,
  useTextEditorMode,
} from "@/store";
import {
  clearCanvas,
  drawSnapGuides,
  drawGroupSelectionOverlay,
  drawMarqueeOverlay,
  drawShapeEditorOverlay,
  getCursorByHandle,
  resolveSelectCursor,
  resolveSelectTarget,
} from "../helpers";
import type { SnapGuidesRenderData } from "../helpers/drawSnapMarker";
import { CanvasPointerPayload } from "./types";
import { normalizeTextStroke } from "../utils/textGeometry";
import { getCaretFromBoxStart } from "../utils/textLayout";
import {
  getAxisConstrainedByShift,
  getStrokeAABB,
  strokeIntersectsMarquee,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  getStrokeSnapAnchors,
  resolveMoveSnapPointer,
  resolveLineEndpointSnap,
} from "@/store/useShapeEditorStore/helpers";
import { SNAP_DISTANCE_PX } from "@/config/snapConfig";
import {
  getCachedSceneSnapContext,
  type SceneSnapContextCache,
} from "../utils/snap/snapContext";
import { drawStrokes, getTransformLayerFromSession } from "../utils";

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
    color: string;
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

const getStrokesInMarquee = (strokes: Stroke[], marqueeBounds: ShapeBounds) =>
  strokes
    .filter((stroke) => strokeIntersectsMarquee(stroke, marqueeBounds))
    .map((stroke) => stroke.id);

const getGroupBoundsAnchors = (
  strokes: Stroke[]
): Array<Pick<StrokePoint, "x" | "y">> => {
  if (strokes.length === 0) return [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    const bounds = getStrokeAABB(stroke);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return [
    { x: minX, y: minY },
    { x: centerX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: centerY },
    { x: maxX, y: maxY },
    { x: centerX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: centerY },
    { x: centerX, y: centerY },
  ];
};

const canSnapSingleResize = (
  stroke: Stroke,
  handle: TransformHandle,
  shiftKey: boolean
) => {
  if (handle === "rotate") return false;
  if (isShapeBoxSnapTool(stroke.tool)) return true;
  if (!isLineLikeSnapTool(stroke.tool)) return false;
  const isAxisConstrained = getAxisConstrainedByShift(stroke.tool, shiftKey);
  return (handle === "nw" || handle === "se") && !isAxisConstrained;
};

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
  const pendingMoveRef = useRef<CanvasPointerPayload | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);
  const sessionSnapCacheRef = useRef<SceneSnapContextCache | null>(null);
  const [marqueeBounds, setMarqueeBounds] = useState<ShapeBounds | null>(null);
  const [activeSnapGuides, setActiveSnapGuides] =
    useState<SnapGuidesRenderData | null>(null);
  const [cursor, setCursor] = useState<React.CSSProperties["cursor"]>("default");
  const textEditorMode = useTextEditorMode();
  const isSnapEnabled = useSnapStore((state) => state.enabled);
  const getCanvasBounds = useCallback(() => {
    const canvas = ctxRef.current?.canvas;
    const width = canvas?.clientWidth ?? window.innerWidth;
    const height = canvas?.clientHeight ?? window.innerHeight;

    return { width, height };
  }, [ctxRef]);

  const clearSessionSnapCache = useCallback(() => {
    sessionSnapCacheRef.current = null;
  }, []);

  const getSceneSnapData = useCallback(
    (excludedIds: string[]) => {
      const canvasBounds = getCanvasBounds();
      return getCachedSceneSnapContext(
        sessionSnapCacheRef,
        present,
        excludedIds,
        canvasBounds
      );
    },
    [getCanvasBounds, present]
  );

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
  const transformLayer = useMemo(
    () => getTransformLayerFromSession(session),
    [session]
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
      clearSessionSnapCache();
      setMarqueeBounds(null);
      setActiveSnapGuides(null);
    },
    [clearSelection, clearSessionSnapCache, present, selectedStrokeIds, setSelection]
  );

  const handlePointerDown = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      const startMarqueeSelection = () => {
        clearSessionSnapCache();
        marqueeStartRef.current = point;
        marqueeShiftRef.current = shiftKey;
        marqueeActiveRef.current = false;
        setMarqueeBounds(null);
        setActiveSnapGuides(null);
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
        setActiveSnapGuides(null);
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
          const boundsStart = normalizedTextStroke.points[0] ?? {
            x: 0,
            y: 0,
            pressure: 0.5,
          };
          const caretPoint = getCaretFromBoxStart(
            boundsStart,
            normalizedText.fontSize
          );
          const startPoint = {
            ...boundsStart,
            ...caretPoint,
          };

          startTextEdit({
            strokeId: normalizedTextStroke.id,
            text: normalizedText.value,
            startPoint,
            fontSize: normalizedText.fontSize,
            color: normalizedTextStroke.color,
          });
          setActiveSnapGuides(null);
          setCursor("default");
          return;
        }
      } else {
        lastTextBodyClickRef.current = null;
      }

      if (selectedStrokes.length > 1 && targetKind === "selected-group-member") {
        startGroupMove({ strokes: selectedStrokes, pointer: point });
        setActiveSnapGuides(null);
        setCursor("grabbing");
        return;
      }

      setSelection([targetStroke.id], targetStroke.id);
      startTransform({ stroke: targetStroke, handle: nextHandle, pointer: point });
      setActiveSnapGuides(null);
      setCursor(nextHandle === "move" ? "grabbing" : getCursorByHandle(nextHandle));
    },
    [
      clearSessionSnapCache,
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

  const processPointerMove = useCallback(
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
        setActiveSnapGuides(null);
        return;
      }

      if (session?.type === "single") {
        if (session.handle === "move") {
          if (!isSnapEnabled) {
            updateTransform(point, { shiftKey });
            setActiveSnapGuides(null);
          } else {
            const movingAnchors = getStrokeSnapAnchors(session.initialStroke);
            const initialCenter =
              movingAnchors.length > 0
                ? undefined
                : {
                    x: session.initialBounds.x + session.initialBounds.width / 2,
                    y: session.initialBounds.y + session.initialBounds.height / 2,
                  };
            const { anchors, segments, axisCandidates } = getSceneSnapData(
              selectedStrokeIds
            );
            const snap = resolveMoveSnapPointer({
              pointer: point,
              startPointer: session.startPointer,
              initialCenter,
              movingAnchors,
              anchors,
              segments,
              axisCandidates,
              snapDistance: SNAP_DISTANCE_PX,
            });

            updateTransform(snap.point, { shiftKey });
            setActiveSnapGuides({
              pointGuide: snap.pointTarget,
              axisGuides: snap.axisSnap,
            });
          }
        } else if (
          isSnapEnabled &&
          canSnapSingleResize(
            session.initialStroke,
            session.handle,
            shiftKey
          )
        ) {
          const { anchors, segments, axisCandidates } = getSceneSnapData(
            selectedStrokeIds
          );
          const snap = resolveLineEndpointSnap(
            point,
            anchors,
            axisCandidates,
            SNAP_DISTANCE_PX,
            SNAP_DISTANCE_PX,
            segments
          );
          updateTransform(snap.point, { shiftKey });
          setActiveSnapGuides({
            pointGuide: snap.pointTarget,
            axisGuides: snap.axisSnap,
          });
        } else {
          updateTransform(point, { shiftKey });
          setActiveSnapGuides(null);
        }
        setCursor(
          session.handle === "move" ? "grabbing" : getCursorByHandle(session.handle)
        );
        return;
      }

      if (session?.type === "groupMove") {
        if (!isSnapEnabled) {
          updateGroupMove(point);
          setActiveSnapGuides(null);
        } else {
          const sessionStrokes = session.strokeIds
            .map((id) => session.initialStrokesById[id])
            .filter(Boolean);
          const movingAnchors = getGroupBoundsAnchors(sessionStrokes);
          if (movingAnchors.length === 0) {
            updateGroupMove(point);
            setActiveSnapGuides(null);
          } else {
            const { anchors, segments, axisCandidates } = getSceneSnapData(
              session.strokeIds
            );
            const snap = resolveMoveSnapPointer({
              pointer: point,
              startPointer: session.startPointer,
              movingAnchors,
              anchors,
              segments,
              axisCandidates,
              snapDistance: SNAP_DISTANCE_PX,
            });
            updateGroupMove(snap.point);
            setActiveSnapGuides({
              pointGuide: snap.pointTarget,
              axisGuides: snap.axisSnap,
            });
          }
        }
        setCursor("grabbing");
        return;
      }

      setActiveSnapGuides(null);
      setCursor(resolveSelectCursor(point, present, selectedStrokes, primarySelectedStroke));
    },
    [
      isSnapEnabled,
      present,
      primarySelectedStroke,
      selectedStrokeIds,
      selectedStrokes,
      session,
      getSceneSnapData,
      updateTransform,
      updateGroupMove,
    ]
  );

  const flushPendingMove = useCallback(() => {
    const pending = pendingMoveRef.current;
    if (!pending) return;
    pendingMoveRef.current = null;
    processPointerMove(pending);
  }, [processPointerMove]);

  const handlePointerMove = useCallback(
    (payload: CanvasPointerPayload) => {
      pendingMoveRef.current = payload;
      if (rafMoveIdRef.current !== null) return;

      rafMoveIdRef.current = window.requestAnimationFrame(() => {
        rafMoveIdRef.current = null;
        flushPendingMove();
      });
    },
    [flushPendingMove]
  );

  const handlePointerUp = useCallback(
    ({ point }: CanvasPointerPayload) => {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      flushPendingMove();
      if (marqueeStartRef.current) {
        finalizeMarquee(point);
        return;
      }

      if (!session) {
        clearSessionSnapCache();
        setActiveSnapGuides(null);
        return;
      }
      if (session.type === "single") {
        commitTransform(present, commitPresent);
        clearSessionSnapCache();
        setActiveSnapGuides(null);
        return;
      }

      commitGroupMove(present, commitPresent);
      clearSessionSnapCache();
      setActiveSnapGuides(null);
    },
    [
      clearSessionSnapCache,
      commitGroupMove,
      commitPresent,
      commitTransform,
      flushPendingMove,
      finalizeMarquee,
      present,
      session,
    ]
  );

  const handlePointerLeave = useCallback(() => {
    if (!session && !marqueeStartRef.current) {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
      clearSessionSnapCache();
      setActiveSnapGuides(null);
      setCursor("default");
    }
  }, [clearSessionSnapCache, session]);

  useEffect(() => {
    if (!session) {
      clearSessionSnapCache();
    }
  }, [clearSessionSnapCache, session]);

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
      clearSessionSnapCache();
      setMarqueeBounds(null);
      setActiveSnapGuides(null);
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
      clearCanvas(ctxRef.current);
      setCursor("default");
    }

    prevToolRef.current = tool;
  }, [
    clearSelection,
    commitGroupMove,
    commitPresent,
    commitTransform,
    clearSessionSnapCache,
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
      return;
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    clearCanvas(ctx);
    if (transformLayer.isTransforming) {
      drawStrokes(transformLayer.activeStrokes, ctx);
    }

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

    if (isSnapEnabled && activeSnapGuides) {
      drawSnapGuides(ctx, activeSnapGuides);
    }
  }, [
    activeSnapGuides,
    ctxRef,
    isSnapEnabled,
    marqueeBounds,
    primarySelectedStroke,
    selectedStrokes,
    session,
    transformLayer,
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

  useEffect(() => {
    return () => {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
    };
  }, []);

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

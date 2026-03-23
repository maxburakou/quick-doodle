import { useCallback, useEffect, useMemo, useRef } from "react";
import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import { useSnapStore, useToolStore } from "@/store";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useShapeEditorStore } from "@/store/useShapeEditorStore";
import {
  clearCanvas,
  getCursorByHandle,
  resolveSelectCursor,
  resolveSelectTarget,
} from "../helpers";
import type { SnapGuidesRenderData } from "../helpers/drawSnapMarker";
import { CanvasPointerPayload } from "./types";
import { enterTextEdit } from "../utils/enterTextEdit";
import {
  applySessionTransform,
  getStrokeAABB,
  getStrokeEndpoints,
  getStrokeRotation,
  getStrokeTransformBounds,
  inverseRotatePoint,
  type SnapSubject,
  resolveSnapForMovingAnchors,
  resolveSnapForInteraction,
} from "@/store/useShapeEditorStore/helpers";
import { SNAP_DISTANCE_PX } from "@/config/snapConfig";

import { useMarqueeSelection } from "./useMarqueeSelection";
import { useSelectModeOverlay } from "./useSelectModeOverlay";
import { useSceneSnapContext } from "./useSceneSnapContext";

const TEXT_EDIT_SECOND_CLICK_INTERVAL_MS = 400;

interface UseSelectModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
}

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

const RESIZE_SIDE_ANCHOR_COUNT = 3;

const pickResizeDrivingAnchors = (
  subject: SnapSubject,
  handle: TransformHandle
): Array<Pick<StrokePoint, "x" | "y">> => {
  if (handle === "move") {
    return subject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  }
  if (handle === "rotate") return [];

  if (
    subject.stroke.tool === Tool.Line ||
    subject.stroke.tool === Tool.Arrow ||
    subject.stroke.tool === Tool.Highlighter
  ) {
    const [start, end] = getStrokeEndpoints(subject.stroke);
    if (handle === "nw") return [{ x: start.x, y: start.y }];
    if (handle === "se") return [{ x: end.x, y: end.y }];
    return subject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  }

  const worldAnchors = subject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  if (worldAnchors.length === 0) return [];

  const transformBounds = getStrokeTransformBounds(subject.stroke);
  const center = {
    x: transformBounds.x + transformBounds.width / 2,
    y: transformBounds.y + transformBounds.height / 2,
  };
  const rotation = getStrokeRotation(subject.stroke);

  const localPairs = worldAnchors.map((world) => ({
    world,
    local: inverseRotatePoint(world, center, rotation),
  }));

  const localContourPoints = subject.segments.flatMap((segment) => [
    inverseRotatePoint(segment.start, center, rotation),
    inverseRotatePoint(segment.end, center, rotation),
  ]);
  const localPoints =
    localContourPoints.length > 0 ? localContourPoints : localPairs.map((pair) => pair.local);

  const xValues = localPoints.map((point) => point.x);
  const yValues = localPoints.map((point) => point.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const targetByHandle: Record<
    Exclude<TransformHandle, "move" | "rotate">,
    { x: number; y: number }
  > = {
    nw: { x: minX, y: minY },
    n: { x: centerX, y: minY },
    ne: { x: maxX, y: minY },
    e: { x: maxX, y: centerY },
    se: { x: maxX, y: maxY },
    s: { x: centerX, y: maxY },
    sw: { x: minX, y: maxY },
    w: { x: minX, y: centerY },
  };

  const target = targetByHandle[handle];
  if (!target) {
    return worldAnchors;
  }

  if (handle === "nw" || handle === "ne" || handle === "sw" || handle === "se") {
    const closest = localPairs.reduce((best, current) => {
      if (!best) return current;
      const bestDistance = Math.hypot(best.local.x - target.x, best.local.y - target.y);
      const currentDistance = Math.hypot(
        current.local.x - target.x,
        current.local.y - target.y
      );
      return currentDistance < bestDistance ? current : best;
    }, null as (typeof localPairs)[number] | null);

    return closest ? [closest.world] : [];
  }

  const isHorizontalHandle = handle === "n" || handle === "s";
  const sorted = [...localPairs].sort((a, b) => {
    const primaryA = isHorizontalHandle
      ? Math.abs(a.local.y - target.y)
      : Math.abs(a.local.x - target.x);
    const primaryB = isHorizontalHandle
      ? Math.abs(b.local.y - target.y)
      : Math.abs(b.local.x - target.x);
    if (primaryA !== primaryB) return primaryA - primaryB;

    const secondaryA = isHorizontalHandle
      ? Math.abs(a.local.x - target.x)
      : Math.abs(a.local.y - target.y);
    const secondaryB = isHorizontalHandle
      ? Math.abs(b.local.x - target.x)
      : Math.abs(b.local.y - target.y);
    return secondaryA - secondaryB;
  });

  const picks = sorted.slice(0, RESIZE_SIDE_ANCHOR_COUNT).map((pair) => pair.world);
  return picks.length > 0 ? picks : worldAnchors;
};

export const getSelectionSnapshot = () => {
  const {
    selectedStrokeIds,
    selectedStrokeIdSet,
    primarySelectedStrokeId,
    session,
  } = useShapeEditorStore.getState();
  const { present } = useHistoryStore.getState();

  const selectedStrokes = present.filter((stroke) =>
    selectedStrokeIdSet.has(stroke.id)
  );
  const primarySelectedStroke =
    present.find((stroke) => stroke.id === primarySelectedStrokeId) ?? null;

  return {
    present,
    selectedStrokeIds,
    selectedStrokeIdSet,
    primarySelectedStrokeId,
    session,
    selectedStrokes,
    primarySelectedStroke,
  };
};

export const useSelectMode = ({
  ctxRef,
}: UseSelectModeParams) => {
  const tool = useToolStore((state) => state.tool);
  const isSnapEnabled = useSnapStore((state) => state.enabled);

  const prevToolRef = useRef<Tool>(tool);
  const lastTextBodyClickRef = useRef<{ strokeId: string; at: number } | null>(null);
  
  const pendingMoveRef = useRef<CanvasPointerPayload | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);
  const activeSnapGuidesRef = useRef<SnapGuidesRenderData | null>(null);
  const cursorRef = useRef<React.CSSProperties["cursor"]>("default");
  
  const marqueeBoundsRef = useRef(null);
  const renderOverlayRef = useRef<() => void>(() => {});
  const {
    getSceneSnapContext: getSceneSnapData,
    clearSceneSnapCache,
    precomputeSceneSnapContext,
  } = useSceneSnapContext({
    ctxRef,
    isSnapEnabled,
  });

  const setCursor = useCallback((newCursor: React.CSSProperties["cursor"]) => {
    if (cursorRef.current === newCursor) return;
    cursorRef.current = newCursor;
    if (ctxRef.current?.canvas) {
      ctxRef.current.canvas.style.cursor = newCursor ?? "default";
    }
  }, [ctxRef]);

  useSelectModeOverlay({
    ctxRef,
    tool,
    isSnapEnabled,
    marqueeBoundsRef,
    activeSnapGuidesRef,
    renderOverlayRef,
  });

  const {
    marqueeStartRef,
    startMarqueeSelection,
    processMarqueeMove,
    finalizeMarquee,
    clearMarqueeState,
  } = useMarqueeSelection({
    clearSessionSnapCache: clearSceneSnapCache,
    marqueeBoundsRef,
    activeSnapGuidesRef,
    setCursor,
    renderOverlay: () => renderOverlayRef.current(),
  });

  const handlePointerDown = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      const {
        present,
        selectedStrokes,
        primarySelectedStroke,
      } = getSelectionSnapshot();
      const {
        setSelection,
        toggleSelection,
        startTransform,
        startGroupMove,
      } = useShapeEditorStore.getState();

      const targetResult = resolveSelectTarget(
        point,
        present,
        selectedStrokes,
        primarySelectedStroke
      );

      if (!targetResult.targetStroke || !targetResult.nextHandle) {
        lastTextBodyClickRef.current = null;
        startMarqueeSelection(point, shiftKey);
        return;
      }

      const { targetStroke, nextHandle, targetKind, isBodyHit } = targetResult;
      if (shiftKey) {
        if (!isBodyHit) {
          startMarqueeSelection(point, shiftKey);
          return;
        }
        toggleSelection(targetStroke.id);
        activeSnapGuidesRef.current = null;
        setCursor("default");
        renderOverlayRef.current();
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
          enterTextEdit(targetStroke);
          activeSnapGuidesRef.current = null;
          setCursor("default");
          renderOverlayRef.current();
          return;
        }
      } else {
        lastTextBodyClickRef.current = null;
      }

      if (selectedStrokes.length > 1 && targetKind === "selected-group-member") {
        startGroupMove({ strokes: selectedStrokes, pointer: point });
        precomputeSceneSnapContext(selectedStrokes.map((stroke) => stroke.id));
        activeSnapGuidesRef.current = null;
        setCursor("grabbing");
        renderOverlayRef.current();
        return;
      }

      setSelection([targetStroke.id], targetStroke.id);
      startTransform({ stroke: targetStroke, handle: nextHandle, pointer: point });
      precomputeSceneSnapContext([targetStroke.id]);
      activeSnapGuidesRef.current = null;
      setCursor(nextHandle === "move" ? "grabbing" : getCursorByHandle(nextHandle));
      renderOverlayRef.current();
    },
    [startMarqueeSelection, setCursor, precomputeSceneSnapContext]
  );

  const processPointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      const {
        present,
        session,
        selectedStrokes,
        primarySelectedStroke,
      } = getSelectionSnapshot();
      const {
        updateTransform,
        updateGroupMove,
      } = useShapeEditorStore.getState();

      if (processMarqueeMove(point)) {
        return;
      }

      if (session?.type === "single") {
        if (isSnapEnabled && session.handle !== "rotate") {
          const { anchors, segments, axisCandidates } = getSceneSnapData();
          const snap = resolveSnapForInteraction({
            rawPointer: point,
            sceneContext: {
              anchors,
              segments,
              axisCandidates,
            },
            buildDraftStroke: (rawPointer) =>
              applySessionTransform(session, rawPointer, shiftKey),
            drivingAnchorSelector: (draftSubject) =>
              session.handle === "move"
                ? draftSubject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }))
                : pickResizeDrivingAnchors(draftSubject, session.handle),
            snapDistance: SNAP_DISTANCE_PX,
          });
          updateTransform(snap.snappedPointer, { shiftKey });
          activeSnapGuidesRef.current = {
            pointGuide: snap.pointGuide,
            axisGuides: snap.axisGuide,
          };
        } else {
          updateTransform(point, { shiftKey });
          activeSnapGuidesRef.current = null;
        }
        setCursor(
          session.handle === "move" ? "grabbing" : getCursorByHandle(session.handle)
        );
        renderOverlayRef.current();
        return;
      }

      if (session?.type === "groupMove") {
        if (!isSnapEnabled) {
          updateGroupMove(point);
          activeSnapGuidesRef.current = null;
        } else {
          const sessionStrokes = session.strokeIds
            .map((id) => session.initialStrokesById[id])
            .filter(Boolean);
          const movingAnchors = getGroupBoundsAnchors(sessionStrokes);
          if (movingAnchors.length === 0) {
            updateGroupMove(point);
            activeSnapGuidesRef.current = null;
          } else {
            const { anchors, segments, axisCandidates } = getSceneSnapData();
            const snap = resolveSnapForMovingAnchors({
              rawPointer: point,
              startPointer: session.startPointer,
              movingAnchors,
              sceneContext: {
                anchors,
                segments,
                axisCandidates,
              },
              snapDistance: SNAP_DISTANCE_PX,
            });
            updateGroupMove(snap.point);
            activeSnapGuidesRef.current = {
              pointGuide: snap.pointTarget,
              axisGuides: snap.axisSnap,
            };
          }
        }
        setCursor("grabbing");
        renderOverlayRef.current();
        return;
      }

      activeSnapGuidesRef.current = null;
      setCursor(resolveSelectCursor(point, present, selectedStrokes, primarySelectedStroke));
      renderOverlayRef.current();
    },
    [isSnapEnabled, getSceneSnapData, setCursor, processMarqueeMove]
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
      if (finalizeMarquee(point)) {
        return;
      }

      const { session } = getSelectionSnapshot();
      const {
        commitTransform,
        commitGroupMove,
      } = useShapeEditorStore.getState();

      if (!session) {
        clearSceneSnapCache();
        activeSnapGuidesRef.current = null;
        renderOverlayRef.current();
        return;
      }
      if (session.type === "single") {
        commitTransform();
        clearSceneSnapCache();
        activeSnapGuidesRef.current = null;
        renderOverlayRef.current();
        return;
      }

      commitGroupMove();
      clearSceneSnapCache();
      activeSnapGuidesRef.current = null;
      renderOverlayRef.current();
    },
    [
      clearSceneSnapCache,
      flushPendingMove,
      finalizeMarquee,
    ]
  );

  const handlePointerLeave = useCallback(() => {
    const { session } = useShapeEditorStore.getState();
    if (!session && !marqueeStartRef.current) {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
      clearSceneSnapCache();
      activeSnapGuidesRef.current = null;
      setCursor("default");
      renderOverlayRef.current();
    }
  }, [clearSceneSnapCache, setCursor, marqueeStartRef]);

  useEffect(() => {
    let prevSession = useShapeEditorStore.getState().session;
    const unsubscribe = useShapeEditorStore.subscribe((state) => {
      const session = state.session;
      if (prevSession && !session) {
        clearSceneSnapCache();
      }
      prevSession = session;
    });
    return unsubscribe;
  }, [clearSceneSnapCache]);

  useEffect(() => {
    const prevTool = prevToolRef.current;
    const switchedFromSelect = prevTool === Tool.Select && tool !== Tool.Select;

    if (switchedFromSelect) {
      const { session, clearSelection } = useShapeEditorStore.getState();

      if (session?.type === "single") {
        useShapeEditorStore.getState().commitTransform();
      } else if (session?.type === "groupMove") {
        useShapeEditorStore.getState().commitGroupMove();
      }

      clearSelection();
      clearMarqueeState();
      
      clearSceneSnapCache();
      marqueeBoundsRef.current = null;
      activeSnapGuidesRef.current = null;
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
      clearCanvas(ctxRef.current);
      setCursor("default");
    }

    prevToolRef.current = tool;
  }, [clearSceneSnapCache, ctxRef, tool, setCursor, clearMarqueeState, marqueeBoundsRef]);

  useEffect(() => {
    const syncSelection = () => {
      const {
        selectedStrokeIds,
        primarySelectedStrokeId,
        clearSelection,
        setSelection,
      } = useShapeEditorStore.getState();
      const { present } = useHistoryStore.getState();

      if (selectedStrokeIds.length === 0) return;

      const existingIds = new Set(present.map((stroke) => stroke.id));
      const nextSelection = selectedStrokeIds.filter((id) => existingIds.has(id));

      if (nextSelection.length === selectedStrokeIds.length) return;

      if (nextSelection.length === 0) {
        clearSelection();
        clearCanvas(ctxRef.current);
        return;
      }

      const nextPrimary =
        primarySelectedStrokeId && existingIds.has(primarySelectedStrokeId)
          ? primarySelectedStrokeId
          : nextSelection[nextSelection.length - 1] ?? null;
      setSelection(nextSelection, nextPrimary);
    };

    syncSelection();

    return useHistoryStore.subscribe(syncSelection);
  }, [ctxRef]);

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
      cursor: cursorRef.current,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave]
  );
};

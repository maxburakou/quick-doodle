import { useCallback, useEffect, useMemo, useRef } from "react";
import { Stroke, Tool, TransformHandle, StrokePoint } from "@/types";
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
  getAxisConstrainedByShift,
  getStrokeAABB,
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

import { useMarqueeSelection } from "./useMarqueeSelection";
import { useSelectModeOverlay } from "./useSelectModeOverlay";

import { getCanvasBoundsFromCtx } from "../utils/getCanvasBounds";

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

/** Read current selection state snapshot from stores */
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
  const sessionSnapCacheRef = useRef<SceneSnapContextCache | null>(null);
  const activeSnapGuidesRef = useRef<SnapGuidesRenderData | null>(null);
  const cursorRef = useRef<React.CSSProperties["cursor"]>("default");
  
  // Shared state for marquee and overlay
  const marqueeBoundsRef = useRef(null);
  const renderOverlayRef = useRef<() => void>(() => {});

  const setCursor = useCallback((newCursor: React.CSSProperties["cursor"]) => {
    if (cursorRef.current === newCursor) return;
    cursorRef.current = newCursor;
    if (ctxRef.current?.canvas) {
      ctxRef.current.canvas.style.cursor = newCursor ?? "default";
    }
  }, [ctxRef]);

  const clearSessionSnapCache = useCallback(() => {
    sessionSnapCacheRef.current = null;
  }, []);

  // Hook 1: Overlay rendering
  useSelectModeOverlay({
    ctxRef,
    tool,
    isSnapEnabled,
    marqueeBoundsRef,
    activeSnapGuidesRef,
    renderOverlayRef,
  });

  // Hook 2: Marquee selection
  const {
    marqueeStartRef,
    startMarqueeSelection,
    processMarqueeMove,
    finalizeMarquee,
    clearMarqueeState,
  } = useMarqueeSelection({
    clearSessionSnapCache,
    marqueeBoundsRef,
    activeSnapGuidesRef,
    setCursor,
    renderOverlay: () => renderOverlayRef.current(),
  });

  const getSceneSnapData = useCallback(
    (excludedIds: string[]) => {
      const { present } = useHistoryStore.getState();
      const canvasBounds = getCanvasBoundsFromCtx(ctxRef);
      return getCachedSceneSnapContext(
        sessionSnapCacheRef,
        present,
        excludedIds,
        canvasBounds
      );
    },
    [ctxRef]
  );

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
        activeSnapGuidesRef.current = null;
        setCursor("grabbing");
        renderOverlayRef.current();
        return;
      }

      setSelection([targetStroke.id], targetStroke.id);
      startTransform({ stroke: targetStroke, handle: nextHandle, pointer: point });
      activeSnapGuidesRef.current = null;
      setCursor(nextHandle === "move" ? "grabbing" : getCursorByHandle(nextHandle));
      renderOverlayRef.current();
    },
    [startMarqueeSelection, setCursor]
  );

  const processPointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      const {
        present,
        selectedStrokeIds,
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
        if (session.handle === "move") {
          if (!isSnapEnabled) {
            updateTransform(point, { shiftKey });
            activeSnapGuidesRef.current = null;
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
            activeSnapGuidesRef.current = {
              pointGuide: snap.pointTarget,
              axisGuides: snap.axisSnap,
            };
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
          activeSnapGuidesRef.current = {
            pointGuide: snap.pointTarget,
            axisGuides: snap.axisSnap,
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
        clearSessionSnapCache();
        activeSnapGuidesRef.current = null;
        renderOverlayRef.current();
        return;
      }
      if (session.type === "single") {
        commitTransform();
        clearSessionSnapCache();
        activeSnapGuidesRef.current = null;
        renderOverlayRef.current();
        return;
      }

      commitGroupMove();
      clearSessionSnapCache();
      activeSnapGuidesRef.current = null;
      renderOverlayRef.current();
    },
    [
      clearSessionSnapCache,
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
      clearSessionSnapCache();
      activeSnapGuidesRef.current = null;
      setCursor("default");
      renderOverlayRef.current();
    }
  }, [clearSessionSnapCache, setCursor, marqueeStartRef]);

  // Clear snap cache when session ends
  useEffect(() => {
    let prevSession = useShapeEditorStore.getState().session;
    const unsubscribe = useShapeEditorStore.subscribe((state) => {
      const session = state.session;
      if (prevSession && !session) {
        clearSessionSnapCache();
      }
      prevSession = session;
    });
    return unsubscribe;
  }, [clearSessionSnapCache]);

  // Handle tool switching away from Select
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
      
      clearSessionSnapCache();
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
  }, [clearSessionSnapCache, ctxRef, tool, setCursor, clearMarqueeState, marqueeBoundsRef]);

  // Sync deleted strokes with selection
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

    // Subscribe to history to trigger sync when present strokes change (e.g. deletion, undo)
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

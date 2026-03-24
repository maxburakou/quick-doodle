import { useCallback, useEffect, useMemo, useRef } from "react";
import { Stroke, Tool } from "@/types";
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
  getGroupBoundsAnchors,
  getStrokeSnapAnchors,
  pickResizeDrivingAnchors,
  resolveSnapForMovingAnchors,
  resolveSnapForInteraction,
} from "@/store/useShapeEditorStore/helpers";
import { SNAP_DISTANCE_PX } from "@/config/snapConfig";

import { useMarqueeSelection } from "./useMarqueeSelection";
import { MarqueeOverlayApi } from "./useMarqueeOverlayController";
import { useSelectModeOverlay } from "./useSelectModeOverlay";
import { useSceneSnapContext } from "./useSceneSnapContext";

const TEXT_EDIT_SECOND_CLICK_INTERVAL_MS = 400;
const MOVE_MID_ANCHOR_EXCLUDED_TOOLS = new Set<Tool>([
  Tool.Arrow,
  Tool.Line,
  Tool.Highlighter,
]);

const getMoveDrivingAnchors = (stroke: Stroke) => {
  const isMidAnchorExcluded = MOVE_MID_ANCHOR_EXCLUDED_TOOLS.has(stroke.tool);

  return getStrokeSnapAnchors(stroke)
    .filter((anchor) => !(isMidAnchorExcluded && anchor.kind === "lineMid"))
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));
};

interface UseSelectModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  marqueeOverlay: MarqueeOverlayApi;
}

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
  marqueeOverlay,
}: UseSelectModeParams) => {
  const tool = useToolStore((state) => state.tool);
  const setTool = useToolStore((state) => state.setTool);
  const isSnapEnabled = useSnapStore((state) => state.enabled);

  const prevToolRef = useRef<Tool>(tool);
  const lastTextBodyClickRef = useRef<{ strokeId: string; at: number } | null>(null);
  
  const pendingMoveRef = useRef<CanvasPointerPayload | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);
  const activeSnapGuidesRef = useRef<SnapGuidesRenderData | null>(null);
  const cursorRef = useRef<React.CSSProperties["cursor"]>("default");

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
    setCursor,
    marqueeOverlay,
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
          setTool(Tool.Text);
          enterTextEdit(targetStroke, { returnToolOnFinish: Tool.Select });
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
    [startMarqueeSelection, setCursor, precomputeSceneSnapContext, setTool]
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
          if (session.handle === "move") {
            const movingAnchors = getMoveDrivingAnchors(session.initialStroke);
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
            updateTransform(snap.point, { shiftKey });
            activeSnapGuidesRef.current = {
              pointGuide: snap.pointTarget,
              axisGuides: snap.axisSnap,
            };
          } else {
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
                pickResizeDrivingAnchors(draftSubject, session.handle),
              snapDistance: SNAP_DISTANCE_PX,
            });
            updateTransform(snap.snappedPointer, { shiftKey });
            activeSnapGuidesRef.current = {
              pointGuide: snap.pointGuide,
              axisGuides: snap.axisGuide,
            };
          }
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
      marqueeOverlay.clear();
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
  }, [clearSceneSnapCache, ctxRef, marqueeOverlay, tool, setCursor, clearMarqueeState]);

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
    [
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    ]
  );
};

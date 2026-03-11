import { useCallback, useRef } from "react";
import { ShapeBounds, Stroke, StrokePoint } from "@/types";
import { useShapeEditorStore } from "@/store/useShapeEditorStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { strokeIntersectsMarquee } from "@/store/useShapeEditorStore/helpers";
import type { SnapGuidesRenderData } from "../helpers/drawSnapMarker";

const MARQUEE_DRAG_THRESHOLD = 3;

export const normalizeMarqueeBounds = (
  start: StrokePoint,
  current: StrokePoint
): ShapeBounds => ({
  x: Math.min(start.x, current.x),
  y: Math.min(start.y, current.y),
  width: Math.abs(current.x - start.x),
  height: Math.abs(current.y - start.y),
});

export const getStrokesInMarquee = (strokes: Stroke[], marqueeBounds: ShapeBounds) =>
  strokes
    .filter((stroke) => strokeIntersectsMarquee(stroke, marqueeBounds))
    .map((stroke) => stroke.id);

interface UseMarqueeSelectionParams {
  clearSessionSnapCache: () => void;
  marqueeBoundsRef: React.MutableRefObject<ShapeBounds | null>;
  activeSnapGuidesRef: React.MutableRefObject<SnapGuidesRenderData | null>;
  setCursor: (cursor: React.CSSProperties["cursor"]) => void;
  renderOverlay: () => void;
}

export const useMarqueeSelection = ({
  clearSessionSnapCache,
  marqueeBoundsRef,
  activeSnapGuidesRef,
  setCursor,
  renderOverlay,
}: UseMarqueeSelectionParams) => {
  const marqueeStartRef = useRef<StrokePoint | null>(null);
  const marqueeShiftRef = useRef(false);
  const marqueeActiveRef = useRef(false);

  const startMarqueeSelection = useCallback(
    (point: StrokePoint, shiftKey: boolean) => {
      clearSessionSnapCache();
      marqueeStartRef.current = point;
      marqueeShiftRef.current = shiftKey;
      marqueeActiveRef.current = false;
      marqueeBoundsRef.current = null;
      activeSnapGuidesRef.current = null;
      setCursor("default");
      renderOverlay();
    },
    [clearSessionSnapCache, setCursor, renderOverlay, marqueeBoundsRef, activeSnapGuidesRef]
  );

  const processMarqueeMove = useCallback(
    (point: StrokePoint) => {
      if (!marqueeStartRef.current) return false;

      const start = marqueeStartRef.current;
      const dx = Math.abs(point.x - start.x);
      const dy = Math.abs(point.y - start.y);
      if (!marqueeActiveRef.current && (dx > MARQUEE_DRAG_THRESHOLD || dy > MARQUEE_DRAG_THRESHOLD)) {
        marqueeActiveRef.current = true;
      }

      if (marqueeActiveRef.current) {
        marqueeBoundsRef.current = normalizeMarqueeBounds(start, point);
        setCursor("crosshair");
      }
      activeSnapGuidesRef.current = null;
      renderOverlay();
      return true; 
    },
    [setCursor, renderOverlay, marqueeBoundsRef, activeSnapGuidesRef]
  );

  const finalizeMarquee = useCallback(
    (pointer: StrokePoint) => {
      const start = marqueeStartRef.current;
      if (!start) return false;

      const { selectedStrokeIds } = useShapeEditorStore.getState();
      const { present } = useHistoryStore.getState();
      const { clearSelection, setSelection } = useShapeEditorStore.getState();

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
      marqueeBoundsRef.current = null;
      activeSnapGuidesRef.current = null;
      renderOverlay();
      return true; 
    },
    [clearSessionSnapCache, renderOverlay, marqueeBoundsRef, activeSnapGuidesRef]
  );

  const clearMarqueeState = useCallback(() => {
    marqueeStartRef.current = null;
    marqueeActiveRef.current = false;
    marqueeShiftRef.current = false;
  }, []);

  return {
    marqueeStartRef,
    marqueeActiveRef,
    startMarqueeSelection,
    processMarqueeMove,
    finalizeMarquee,
    clearMarqueeState,
  };
};

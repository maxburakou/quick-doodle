import { useCallback, useRef } from "react";
import { ShapeBounds, Stroke, StrokePoint } from "@/types";
import { useShapeEditorStore } from "@/store/useShapeEditorStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { strokeIntersectsMarquee } from "@/store/useShapeEditorStore/helpers";

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
  setCursor: (cursor: React.CSSProperties["cursor"]) => void;
  marqueeOverlay: {
    setActiveBounds: (bounds: ShapeBounds | null) => void;
    fadeOutBounds: (bounds: ShapeBounds) => void;
    clear: () => void;
  };
}

export const useMarqueeSelection = ({
  clearSessionSnapCache,
  setCursor,
  marqueeOverlay,
}: UseMarqueeSelectionParams) => {
  const marqueeStartRef = useRef<StrokePoint | null>(null);
  const marqueeShiftRef = useRef(false);
  const marqueeActiveRef = useRef(false);

  const resetMarqueeOverlay = useCallback(() => {
    marqueeOverlay.clear();
  }, [marqueeOverlay]);

  const startMarqueeSelection = useCallback(
    (point: StrokePoint, shiftKey: boolean) => {
      clearSessionSnapCache();
      marqueeStartRef.current = point;
      marqueeShiftRef.current = shiftKey;
      marqueeActiveRef.current = false;
      resetMarqueeOverlay();
      setCursor("default");
    },
    [
      clearSessionSnapCache,
      resetMarqueeOverlay,
      setCursor,
    ]
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
        marqueeOverlay.setActiveBounds(normalizeMarqueeBounds(start, point));
      }
      return true; 
    },
    [marqueeOverlay]
  );

  const finalizeMarquee = useCallback(
    (pointer: StrokePoint) => {
      const start = marqueeStartRef.current;
      if (!start) return false;

      const { selectedStrokeIds } = useShapeEditorStore.getState();
      const { present } = useHistoryStore.getState();
      const { clearSelection, setSelection } = useShapeEditorStore.getState();

      const shouldApplyMarquee = marqueeActiveRef.current;
      let finalBounds: ShapeBounds | null = null;
      if (!shouldApplyMarquee) {
        if (!marqueeShiftRef.current) {
          clearSelection();
        }
      } else {
        const bounds = normalizeMarqueeBounds(start, pointer);
        finalBounds = bounds;
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
      if (finalBounds) {
        marqueeOverlay.fadeOutBounds(finalBounds);
      } else {
        resetMarqueeOverlay();
      }
      return true; 
    },
    [
      clearSessionSnapCache,
      marqueeOverlay,
      resetMarqueeOverlay,
    ]
  );

  const clearMarqueeState = useCallback(() => {
    marqueeStartRef.current = null;
    marqueeActiveRef.current = false;
    marqueeShiftRef.current = false;
    resetMarqueeOverlay();
  }, [resetMarqueeOverlay]);

  return {
    marqueeStartRef,
    startMarqueeSelection,
    processMarqueeMove,
    finalizeMarquee,
    clearMarqueeState,
  };
};

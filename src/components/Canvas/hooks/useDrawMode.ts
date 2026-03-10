import { useCallback, useEffect, useMemo, useRef } from "react";
import { isFillableShapeTool, Stroke, StrokePoint, Tool } from "@/types";
import { useSnapStore, useToolStore } from "@/store";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useToolSettingsStore } from "@/store/useToolSettingsStore";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import {
  type SnapComputation,
  getAxisConstrainedByShift,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  resolveLineEndpointSnap,
  resolveShapeCreateEndpointSnap,
} from "@/store/useShapeEditorStore/helpers";
import { SNAP_DISTANCE_PX } from "@/config/snapConfig";
import {
  clearCanvas,
  drawCanvas,
  drawSnapGuides,
  finalizeStrokePoints,
} from "../helpers";
import { CanvasPointerPayload } from "./types";
import { SceneSnapContext, SceneSnapContextCache } from "../utils/snap/snapContext";
import { getAsyncCachedSceneSnapContext } from "../utils/snap/snapWorkerManager";
import { getCanvasBoundsFromCtx } from "../utils/getCanvasBounds";

interface UseDrawModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
}

interface SnapPreview {
  point: StrokePoint;
  pointTarget: StrokePoint | null;
  axisSnap: SnapComputation["axisSnap"];
}

const EMPTY_EXCLUDED_IDS: string[] = [];

const getToolSettings = () => {
  const { color, thickness, shapeFill } = useToolSettingsStore.getState();
  return { color, thickness, shapeFill };
};

const getShapeFillData = (color: string, shapeFillEnabled: boolean, tool: Tool) => {
  if (!shapeFillEnabled || !isFillableShapeTool(tool)) return undefined;
  return { color, style: "solid" as const };
};

const toGuidesRenderData = (snap: SnapPreview) => ({
  pointGuide: snap.pointTarget,
  axisGuides: snap.axisSnap,
});

export const useDrawMode = ({
  ctxRef,
}: UseDrawModeParams) => {
  const pointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const drawableSeedRef = useRef<number>(Date.now());
  const strokeIdRef = useRef<string>("");
  const pendingMoveRef = useRef<CanvasPointerPayload | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);

  const tool = useToolStore((state) => state.tool);
  const isSnapEnabled = useSnapStore((state) => state.enabled);

  const sessionSnapCacheRef = useRef<SceneSnapContextCache | null>(null);

  const fallbackContext = useMemo<SceneSnapContext>(
    () => ({
      anchors: [],
      segments: [],
      axisCandidates: [],
    }),
    []
  );

  useEffect(() => {
    if (!isSnapEnabled) return;

    const compute = async () => {
      try {
        const { present } = useHistoryStore.getState();
        const canvasBounds = getCanvasBoundsFromCtx(ctxRef);
        await getAsyncCachedSceneSnapContext(
          sessionSnapCacheRef,
          present,
          EMPTY_EXCLUDED_IDS,
          canvasBounds
        );
      } catch (err) {
        console.error("Failed to precompute snap context:", err);
      }
    };

    compute();
    return useHistoryStore.subscribe(compute);
  }, [ctxRef, isSnapEnabled]);

  const getSceneSnapContext = useCallback(() => {
    return sessionSnapCacheRef.current?.context ?? fallbackContext;
  }, [fallbackContext]);

  const getAxisConstrainState = useCallback(
    (shiftKey: boolean) => getAxisConstrainedByShift(tool, shiftKey),
    [tool]
  );

  const resolveCreateSnap = useCallback(
    (point: StrokePoint, shiftKey: boolean): SnapPreview => {
      if (!isSnapEnabled) {
        return { point, pointTarget: null, axisSnap: null };
      }
      const isAxisConstrained = getAxisConstrainState(shiftKey);

      if (isLineLikeSnapTool(tool) && !isAxisConstrained) {
        const { anchors, axisCandidates, segments } = getSceneSnapContext();
        return resolveLineEndpointSnap(
          point,
          anchors,
          axisCandidates,
          SNAP_DISTANCE_PX,
          SNAP_DISTANCE_PX,
          segments
        );
      }

      if (isShapeBoxSnapTool(tool)) {
        const startPoint = pointsRef.current[0];
        if (!startPoint) {
          return { point, pointTarget: null, axisSnap: null };
        }
        const { anchors, segments, axisCandidates } = getSceneSnapContext();
        return resolveShapeCreateEndpointSnap({
          startPoint,
          point,
          tool,
          shiftKey,
          anchors,
          segments,
          axisCandidates,
          snapDistance: SNAP_DISTANCE_PX,
        });
      }

      return { point, pointTarget: null, axisSnap: null };
    },
    [
      getAxisConstrainState,
      getSceneSnapContext,
      isSnapEnabled,
      tool,
    ]
  );

  const withSnappedEndpoint = useCallback(
    (finalizedPoints: StrokePoint[], shiftKey: boolean) => {
      const isAxisConstrained = getAxisConstrainState(shiftKey);
      if (finalizedPoints.length < 2) return finalizedPoints;
      if (!isSnapEnabled) return finalizedPoints;
      if (!isLineLikeSnapTool(tool) && !isShapeBoxSnapTool(tool)) {
        return finalizedPoints;
      }

      const endpointCandidate = finalizedPoints[finalizedPoints.length - 1];
      const startPoint = finalizedPoints[0];
      const { anchors, axisCandidates, segments } = getSceneSnapContext();
      const snap: SnapPreview = isShapeBoxSnapTool(tool)
        ? resolveShapeCreateEndpointSnap({
            startPoint,
            point: endpointCandidate,
            tool,
            shiftKey,
            anchors,
            segments,
            axisCandidates,
            snapDistance: SNAP_DISTANCE_PX,
          })
        : isLineLikeSnapTool(tool) && !isAxisConstrained
          ? resolveLineEndpointSnap(
              endpointCandidate,
              anchors,
              axisCandidates,
              SNAP_DISTANCE_PX,
              SNAP_DISTANCE_PX,
              segments
            )
          : { point: endpointCandidate, pointTarget: null, axisSnap: null };

      return [
        finalizedPoints[0],
        {
          ...finalizedPoints[finalizedPoints.length - 1],
          ...snap.point,
        },
      ];
    },
    [
      getAxisConstrainState,
      getSceneSnapContext,
      isSnapEnabled,
      tool,
    ]
  );

  const startDrawing = () => {
    isDrawingRef.current = true;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handlePointerDown = useCallback(
    ({ point }: CanvasPointerPayload) => {
      const { color, thickness, shapeFill } = getToolSettings();
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
        shapeFill: getShapeFillData(color, shapeFill, tool),
      };

      drawCanvas([stroke], ctxRef.current);
    },
    [tool, ctxRef]
  );

  const processPointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
      const { color, thickness, shapeFill } = getToolSettings();
      const isAxisConstrained = getAxisConstrainState(shiftKey);

      const snap = resolveCreateSnap(point, shiftKey);
      pointsRef.current.push(snap.point);

      const stroke: Stroke = {
        id: strokeIdRef.current,
        points: pointsRef.current,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
        isShiftPressed: isAxisConstrained,
        shapeFill: getShapeFillData(color, shapeFill, tool),
      };

      const ctx = ctxRef.current;
      drawCanvas([stroke], ctx);
      if (ctx && (snap.pointTarget || snap.axisSnap)) {
        drawSnapGuides(ctx, toGuidesRenderData(snap));
      }
    },
    [
      ctxRef,
      getAxisConstrainState,
      resolveCreateSnap,
      tool,
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
    ({ shiftKey }: CanvasPointerPayload) => {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      flushPendingMove();
      if (!isDrawingRef.current) return;
      const { color, thickness, shapeFill } = getToolSettings();
      const isAxisConstrained = getAxisConstrainState(shiftKey);

      stopDrawing();

      let finalizedPoints = finalizeStrokePoints(
        pointsRef.current,
        tool,
        isAxisConstrained
      );
      finalizedPoints = withSnappedEndpoint(finalizedPoints, shiftKey);

      const stroke: Stroke = {
        id: strokeIdRef.current || createStrokeId(),
        points: finalizedPoints,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
        shapeFill: getShapeFillData(color, shapeFill, tool),
      };

      useHistoryStore.getState().addAction(stroke);
      pointsRef.current = [];
      strokeIdRef.current = "";
      clearCanvas(ctxRef.current);
    },
    [
      ctxRef,
      flushPendingMove,
      getAxisConstrainState,
      tool,
      withSnappedEndpoint,
    ]
  );

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
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp]
  );
};

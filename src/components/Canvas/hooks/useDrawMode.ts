import { useCallback, useMemo, useRef } from "react";
import { isFillableShapeTool, Stroke, StrokePoint, Tool } from "@/types";
import { useSnapStore } from "@/store";
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
import { buildSceneSnapContext } from "../utils/snap/snapContext";

interface UseDrawModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  present: Stroke[];
  color: string;
  thickness: number;
  shapeFill: boolean;
  tool: Tool;
  addAction: (stroke: Stroke) => void;
}

interface SnapPreview {
  point: StrokePoint;
  pointTarget: StrokePoint | null;
  axisSnap: SnapComputation["axisSnap"];
}

const EMPTY_EXCLUDED_IDS: string[] = [];

export const useDrawMode = ({
  ctxRef,
  present,
  color,
  thickness,
  shapeFill: shapeFillEnabled,
  tool,
  addAction,
}: UseDrawModeParams) => {
  const pointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const drawableSeedRef = useRef<number>(Date.now());
  const strokeIdRef = useRef<string>("");
  const getCanvasBounds = useCallback(() => {
    const canvas = ctxRef.current?.canvas;
    const width = canvas?.clientWidth ?? window.innerWidth;
    const height = canvas?.clientHeight ?? window.innerHeight;

    return { width, height };
  }, [ctxRef]);
  const getSceneSnapContext = useCallback(
    () => buildSceneSnapContext(present, EMPTY_EXCLUDED_IDS, getCanvasBounds()),
    [getCanvasBounds, present]
  );
  const getAxisConstrainState = useCallback(
    (shiftKey: boolean) => getAxisConstrainedByShift(tool, shiftKey),
    [tool]
  );
  const isSnapEnabled = useSnapStore((state) => state.enabled);
  const shapeFillData = useMemo(() => {
    if (!shapeFillEnabled || !isFillableShapeTool(tool)) return undefined;

    return { color, style: "solid" as const };
  }, [color, shapeFillEnabled, tool]);

  const toGuidesRenderData = (snap: SnapPreview) => ({
    pointGuide: snap.pointTarget,
    axisGuides: snap.axisSnap,
  });

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
        shapeFill: shapeFillData,
      };

      drawCanvas([stroke], ctxRef.current);
    },
    [color, thickness, tool, ctxRef, shapeFillData]
  );

  const handlePointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
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
        shapeFill: shapeFillData,
      };

      const ctx = ctxRef.current;
      drawCanvas([stroke], ctx);
      if (ctx && (snap.pointTarget || snap.axisSnap)) {
        drawSnapGuides(ctx, toGuidesRenderData(snap));
      }
    },
    [
      color,
      ctxRef,
      getAxisConstrainState,
      resolveCreateSnap,
      shapeFillData,
      thickness,
      tool,
    ]
  );

  const handlePointerUp = useCallback(
    ({ shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
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
        shapeFill: shapeFillData,
      };

      addAction(stroke);
      pointsRef.current = [];
      strokeIdRef.current = "";
      clearCanvas(ctxRef.current);
    },
    [
      addAction,
      color,
      ctxRef,
      getAxisConstrainState,
      shapeFillData,
      thickness,
      tool,
      withSnappedEndpoint,
    ]
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

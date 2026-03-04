import { useCallback, useMemo, useRef } from "react";
import { Stroke, StrokePoint, Tool } from "@/types";
import { useSnapStore } from "@/store";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import {
  type SnapComputation,
  getSceneAxisSnapCandidates,
  getSceneSnapAnchors,
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

interface UseDrawModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  present: Stroke[];
  color: string;
  thickness: number;
  tool: Tool;
  addAction: (stroke: Stroke) => void;
}

interface SnapPreview {
  point: StrokePoint;
  pointTarget: StrokePoint | null;
  axisSnap: SnapComputation["axisSnap"];
}

export const useDrawMode = ({
  ctxRef,
  present,
  color,
  thickness,
  tool,
  addAction,
}: UseDrawModeParams) => {
  const pointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const drawableSeedRef = useRef<number>(Date.now());
  const strokeIdRef = useRef<string>("");
  const getSceneAnchors = useCallback(
    () => getSceneSnapAnchors(present, new Set()),
    [present]
  );
  const getSceneAxisCandidates = useCallback(
    () => getSceneAxisSnapCandidates(present, new Set()),
    [present]
  );
  const getAxisConstrainState = useCallback(
    (shiftKey: boolean) => (tool === Tool.Highlighter ? !shiftKey : shiftKey),
    [tool]
  );
  const isSnapEnabled = useSnapStore((state) => state.enabled);

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
        return resolveLineEndpointSnap(
          point,
          getSceneAnchors(),
          getSceneAxisCandidates(),
          SNAP_DISTANCE_PX
        );
      }

      if (isShapeBoxSnapTool(tool)) {
        const startPoint = pointsRef.current[0];
        if (!startPoint) {
          return { point, pointTarget: null, axisSnap: null };
        }
        return resolveShapeCreateEndpointSnap({
          startPoint,
          point,
          tool,
          shiftKey,
          anchors: getSceneAnchors(),
          axisCandidates: getSceneAxisCandidates(),
          snapDistance: SNAP_DISTANCE_PX,
        });
      }

      return { point, pointTarget: null, axisSnap: null };
    },
    [
      getAxisConstrainState,
      getSceneAnchors,
      getSceneAxisCandidates,
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
      const snap: SnapPreview = isShapeBoxSnapTool(tool)
        ? resolveShapeCreateEndpointSnap({
            startPoint,
            point: endpointCandidate,
            tool,
            shiftKey,
            anchors: getSceneAnchors(),
            axisCandidates: getSceneAxisCandidates(),
            snapDistance: SNAP_DISTANCE_PX,
          })
        : isLineLikeSnapTool(tool) && !isAxisConstrained
          ? resolveLineEndpointSnap(
              endpointCandidate,
              getSceneAnchors(),
              getSceneAxisCandidates(),
              SNAP_DISTANCE_PX
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
      getSceneAnchors,
      getSceneAxisCandidates,
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
      };

      drawCanvas([stroke], ctxRef.current);
    },
    [color, thickness, tool, ctxRef]
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
      };

      const ctx = ctxRef.current;
      drawCanvas([stroke], ctx);
      if (ctx && (snap.pointTarget || snap.axisSnap)) {
        drawSnapGuides(ctx, toGuidesRenderData(snap));
      }
    },
    [color, ctxRef, getAxisConstrainState, resolveCreateSnap, thickness, tool]
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
      };

      addAction(stroke);
      pointsRef.current = [];
      strokeIdRef.current = "";
      clearCanvas(ctxRef.current);
    },
    [addAction, color, ctxRef, getAxisConstrainState, thickness, tool, withSnappedEndpoint]
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

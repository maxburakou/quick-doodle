import { useCallback, useMemo, useRef } from "react";
import { Stroke, StrokePoint, Tool } from "@/types";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import {
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
  target: StrokePoint | null;
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
  const getSceneAnchors = () => getSceneSnapAnchors(present, new Set());
  const getAxisConstrainState = (shiftKey: boolean) =>
    tool === Tool.Highlighter ? !shiftKey : shiftKey;

  const resolveCreateSnap = (
    point: StrokePoint,
    shiftKey: boolean,
    altKey: boolean
  ): SnapPreview => {
    const isAxisConstrained = getAxisConstrainState(shiftKey);
    if (altKey) {
      return { point, target: null };
    }

    if (isLineLikeSnapTool(tool) && !isAxisConstrained) {
      return resolveLineEndpointSnap(point, getSceneAnchors(), SNAP_DISTANCE_PX);
    }

    if (isShapeBoxSnapTool(tool)) {
      const startPoint = pointsRef.current[0];
      if (!startPoint) {
        return { point, target: null };
      }
      return resolveShapeCreateEndpointSnap({
        startPoint,
        point,
        tool,
        shiftKey,
        anchors: getSceneAnchors(),
        snapDistance: SNAP_DISTANCE_PX,
      });
    }

    return { point, target: null };
  };

  const withSnappedEndpoint = (
    finalizedPoints: StrokePoint[],
    shiftKey: boolean,
    altKey: boolean
  ) => {
    const isAxisConstrained = getAxisConstrainState(shiftKey);
    if (finalizedPoints.length < 2) return finalizedPoints;
    if (!isLineLikeSnapTool(tool) && !isShapeBoxSnapTool(tool)) {
      return finalizedPoints;
    }

    const endpointCandidate = finalizedPoints[finalizedPoints.length - 1];
    const startPoint = finalizedPoints[0];
    const snap: SnapPreview = isShapeBoxSnapTool(tool)
      ? altKey
        ? { point: endpointCandidate, target: null }
        : resolveShapeCreateEndpointSnap({
            startPoint,
            point: endpointCandidate,
            tool,
            shiftKey,
            anchors: getSceneAnchors(),
            snapDistance: SNAP_DISTANCE_PX,
          })
      : isLineLikeSnapTool(tool) && !isAxisConstrained && !altKey
        ? resolveLineEndpointSnap(
            endpointCandidate,
            getSceneAnchors(),
            SNAP_DISTANCE_PX
          )
        : { point: endpointCandidate, target: null };

    return [
      finalizedPoints[0],
      {
        ...finalizedPoints[finalizedPoints.length - 1],
        ...snap.point,
      },
    ];
  };

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
    ({ point, shiftKey, altKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
      const isAxisConstrained = getAxisConstrainState(shiftKey);

      const snap = resolveCreateSnap(point, shiftKey, altKey);
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
      if (ctx && snap.target) {
        drawSnapGuides(ctx, snap.target);
      }
    },
    [color, thickness, tool, present, ctxRef]
  );

  const handlePointerUp = useCallback(
    ({ shiftKey, altKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
      const isAxisConstrained = getAxisConstrainState(shiftKey);

      stopDrawing();

      let finalizedPoints = finalizeStrokePoints(
        pointsRef.current,
        tool,
        isAxisConstrained
      );
      finalizedPoints = withSnappedEndpoint(finalizedPoints, shiftKey, altKey);

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
    [addAction, color, thickness, tool, present, ctxRef]
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

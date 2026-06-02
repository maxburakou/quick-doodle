import { useCallback, useEffect, useMemo, useRef } from "react";
import { isFillableShapeTool, Stroke, StrokePoint, Tool } from "@/types";
import { useSnapStore, useToolStore } from "@/store";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useToolSettingsStore } from "@/store/useToolSettingsStore";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import {
  type InteractionSnapResult,
  getConstrainedShapeEndpoint,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  resolveNearestSegmentSnap,
  resolveNearestSnap,
  resolveSnapInteractionPolicy,
  resolveSnapForInteraction,
} from "@/store/useShapeEditorStore/helpers";
import {
  pickDrawDrivingAnchors,
  pickDrawStartDrivingAnchors,
} from "@/store/useShapeEditorStore/helpers/snap/selectors";
import { SNAP_DISTANCE_PX } from "@/config/snapConfig";
import { getSmartAssistController } from "@/features/smartAssist";
import {
  clearCanvas,
  drawCanvas,
  drawSnapGuides,
  finalizeStrokePoints,
} from "../helpers";
import { CanvasPointerPayload } from "./types";
import { useSceneSnapContext } from "./useSceneSnapContext";

interface UseDrawModeParams {
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
}

interface SnapPreview {
  point: StrokePoint;
  startPoint?: StrokePoint;
  pointTarget: StrokePoint | null;
  axisSnap: InteractionSnapResult["axisGuide"];
}

type ShapeStartSnapLock = NonNullable<InteractionSnapResult["axisGuide"]>;

const EMPTY_EXCLUDED_IDS: string[] = [];

const getToolSettings = () => {
  const { color, thickness, shapeFill } = useToolSettingsStore.getState();
  return { color, thickness, shapeFill };
};

const getShapeFillData = (color: string, shapeFillEnabled: boolean, tool: Tool) => {
  if (!shapeFillEnabled || !isFillableShapeTool(tool)) return undefined;
  return { color, style: "solid" as const };
};

const buildDrawSnapDraft = (
  startPoint: StrokePoint,
  endPoint: StrokePoint,
  tool: Tool,
  drawableSeed: number,
  thickness: number,
  shapeFill: ReturnType<typeof getShapeFillData>,
  id: string
): Stroke => ({
  id,
  points: [startPoint, endPoint],
  color: "",
  thickness,
  tool,
  drawableSeed,
  shapeFill,
});

const toGuidesRenderData = (snap: SnapPreview) => ({
  pointGuide: snap.pointTarget,
  axisGuides: snap.axisSnap,
});

const isTwoPointSnapTool = (tool: Tool) =>
  isLineLikeSnapTool(tool) || isShapeBoxSnapTool(tool);

const pickDrawDraftDrivingAnchors: NonNullable<
  Parameters<typeof resolveSnapForInteraction>[0]["drivingAnchorSelector"]
> = (draftSubject) =>
  pickDrawDrivingAnchors(draftSubject.stroke, draftSubject.anchors);

const pickDrawStartDraftDrivingAnchors: NonNullable<
  Parameters<typeof resolveSnapForInteraction>[0]["drivingAnchorSelector"]
> = (draftSubject) =>
  pickDrawStartDrivingAnchors(draftSubject.stroke);

const translatePoint = (
  point: StrokePoint,
  delta: Pick<StrokePoint, "x" | "y">
): StrokePoint => ({
  ...point,
  x: point.x + delta.x,
  y: point.y + delta.y,
});

const getLockedAxisCandidates = (axisSnap: ShapeStartSnapLock) => [
  ...(axisSnap.guideX === undefined
    ? []
    : [
        {
          strokeId: "__draw-start-snap__",
          kind: "left" as const,
          x: axisSnap.guideX,
          y: 0,
        },
      ]),
  ...(axisSnap.guideY === undefined
    ? []
    : [
        {
          strokeId: "__draw-start-snap__",
          kind: "top" as const,
          x: 0,
          y: axisSnap.guideY,
        },
      ]),
];

export const useDrawMode = ({
  ctxRef,
}: UseDrawModeParams) => {
  const smartAssistController = useMemo(() => getSmartAssistController(), []);
  const pointsRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);
  const drawableSeedRef = useRef<number>(Date.now());
  const strokeIdRef = useRef<string>("");
  const rawStartPointRef = useRef<StrokePoint | null>(null);
  const shapeStartSnapRef = useRef<ShapeStartSnapLock | null>(null);
  const pendingMoveRef = useRef<CanvasPointerPayload | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);

  const tool = useToolStore((state) => state.tool);
  const isSnapEnabled = useSnapStore((state) => state.enabled);
  const { getSceneSnapContext } = useSceneSnapContext({
    ctxRef,
    isSnapEnabled,
    autoPrecomputeExcludedIds: EMPTY_EXCLUDED_IDS,
  });

  const resolveStartSnap = useCallback(
    (point: StrokePoint, shiftKey: boolean): StrokePoint => {
      if (!isSnapEnabled || !isLineLikeSnapTool(tool)) {
        return point;
      }

      const policy = resolveSnapInteractionPolicy({
        mode: "draw",
        tool,
        shiftKey,
      });
      if (policy.snapDisabled) {
        return point;
      }

      const { anchors, segments } = getSceneSnapContext();
      const pointSnap = resolveNearestSnap(point, anchors, SNAP_DISTANCE_PX);
      if (pointSnap) {
        return {
          ...point,
          x: pointSnap.snappedX,
          y: pointSnap.snappedY,
        };
      }

      const segmentSnap = resolveNearestSegmentSnap(
        point,
        segments,
        SNAP_DISTANCE_PX
      );
      if (!segmentSnap) {
        return point;
      }

      return {
        ...point,
        x: segmentSnap.snappedX,
        y: segmentSnap.snappedY,
      };
    },
    [getSceneSnapContext, isSnapEnabled, tool]
  );

  const resolveCreateSnap = useCallback(
    (point: StrokePoint, shiftKey: boolean): SnapPreview => {
      if (!isSnapEnabled) {
        return { point, pointTarget: null, axisSnap: null };
      }
      const startPoint = pointsRef.current[0];
      if (!startPoint) {
        return { point, pointTarget: null, axisSnap: null };
      }

      if (!isTwoPointSnapTool(tool)) {
        return { point, pointTarget: null, axisSnap: null };
      }
      const policy = resolveSnapInteractionPolicy({
        mode: "draw",
        tool,
        shiftKey,
      });
      if (policy.snapDisabled) {
        if (!isShapeBoxSnapTool(tool)) {
          return { point, pointTarget: null, axisSnap: null };
        }

        return {
          point: getConstrainedShapeEndpoint(startPoint, point, tool, shiftKey),
          pointTarget: null,
          axisSnap: null,
        };
      }

      const { color, thickness, shapeFill } = getToolSettings();
      const rawStartPoint = rawStartPointRef.current ?? startPoint;
      const rawPointer = isShapeBoxSnapTool(tool)
        ? getConstrainedShapeEndpoint(rawStartPoint, point, tool, shiftKey)
        : point;
      const { anchors, segments, axisCandidates } = getSceneSnapContext();
      if (isShapeBoxSnapTool(tool) && !shapeStartSnapRef.current) {
        const startSnap = resolveSnapForInteraction({
          rawPointer: rawStartPoint,
          sceneContext: {
            anchors: [],
            segments: [],
            axisCandidates,
          },
          drivingAnchorSelector: pickDrawStartDraftDrivingAnchors,
          buildDraftStroke: (nextStartPoint) =>
            buildDrawSnapDraft(
              nextStartPoint,
              rawPointer,
              tool,
              drawableSeedRef.current,
              thickness,
              getShapeFillData(color, shapeFill, tool),
              "__draw-start-draft__"
            ),
          snapDistance: SNAP_DISTANCE_PX,
          axisSnapDistance: SNAP_DISTANCE_PX,
        });
        if (startSnap.axisGuide) {
          shapeStartSnapRef.current = startSnap.axisGuide;
        }
      }

      const startSnap = shapeStartSnapRef.current
        ? resolveSnapForInteraction({
            rawPointer: rawStartPoint,
            sceneContext: {
              anchors: [],
              segments: [],
              axisCandidates: getLockedAxisCandidates(shapeStartSnapRef.current),
            },
            drivingAnchorSelector: pickDrawStartDraftDrivingAnchors,
            buildDraftStroke: (nextStartPoint) =>
              buildDrawSnapDraft(
                nextStartPoint,
                rawPointer,
                tool,
                drawableSeedRef.current,
                thickness,
                getShapeFillData(color, shapeFill, tool),
                "__draw-start-locked-draft__"
              ),
            snapDistance: SNAP_DISTANCE_PX,
            axisSnapDistance: SNAP_DISTANCE_PX,
          })
        : null;
      const startDelta = startSnap
        ? {
            x: startSnap.snappedPointer.x - rawStartPoint.x,
            y: startSnap.snappedPointer.y - rawStartPoint.y,
          }
        : { x: 0, y: 0 };
      const snappedStartPoint = startSnap?.snappedPointer ?? startPoint;
      const snapPointer = startSnap ? translatePoint(rawPointer, startDelta) : rawPointer;
      const snapSceneContext = isShapeBoxSnapTool(tool)
        ? {
            anchors: [],
            segments: [],
            axisCandidates,
          }
        : {
            anchors,
            segments,
            axisCandidates,
          };
      const snap = resolveSnapForInteraction({
        rawPointer: snapPointer,
        sceneContext: snapSceneContext,
        drivingAnchorSelector: pickDrawDraftDrivingAnchors,
        buildDraftStroke: (nextPointer) =>
          buildDrawSnapDraft(
            snappedStartPoint,
            nextPointer,
            tool,
            drawableSeedRef.current,
            thickness,
            getShapeFillData(color, shapeFill, tool),
            "__draw-draft__"
          ),
        snapDistance: SNAP_DISTANCE_PX,
        axisSnapDistance: SNAP_DISTANCE_PX,
      });

      return {
        point: snap.snappedPointer,
        startPoint: startSnap ? snappedStartPoint : undefined,
        pointTarget: snap.pointGuide,
        axisSnap:
          snap.axisGuide ?? (snap.pointGuide ? null : startSnap?.axisGuide ?? null),
      };
    },
    [
      getSceneSnapContext,
      isSnapEnabled,
      tool,
    ]
  );

  const withSnappedEndpoint = useCallback(
    (finalizedPoints: StrokePoint[], shiftKey: boolean) => {
      if (finalizedPoints.length < 2) return finalizedPoints;
      if (!isSnapEnabled) return finalizedPoints;
      if (!isTwoPointSnapTool(tool)) {
        return finalizedPoints;
      }

      const endpointCandidate = finalizedPoints[finalizedPoints.length - 1];
      const startPoint = finalizedPoints[0];
      const policy = resolveSnapInteractionPolicy({
        mode: "draw",
        tool,
        shiftKey,
      });
      if (policy.snapDisabled) {
        if (!isShapeBoxSnapTool(tool)) {
          return finalizedPoints;
        }

        const constrainedPointer = getConstrainedShapeEndpoint(
          startPoint,
          endpointCandidate,
          tool,
          shiftKey
        );

        return [
          finalizedPoints[0],
          {
            ...finalizedPoints[finalizedPoints.length - 1],
            ...constrainedPointer,
          },
        ];
      }
      const { color, thickness, shapeFill } = getToolSettings();
      const rawPointer = isShapeBoxSnapTool(tool)
        ? getConstrainedShapeEndpoint(startPoint, endpointCandidate, tool, shiftKey)
        : endpointCandidate;
      const { anchors, axisCandidates, segments } = getSceneSnapContext();
      const snapSceneContext = isShapeBoxSnapTool(tool)
        ? {
            anchors: [],
            segments: [],
            axisCandidates,
          }
        : {
            anchors,
            segments,
            axisCandidates,
          };
      const snap = resolveSnapForInteraction({
        rawPointer,
        sceneContext: snapSceneContext,
        drivingAnchorSelector: pickDrawDraftDrivingAnchors,
        buildDraftStroke: (nextPointer) =>
          buildDrawSnapDraft(
            startPoint,
            nextPointer,
            tool,
            drawableSeedRef.current,
            thickness,
            getShapeFillData(color, shapeFill, tool),
            "__draw-finalize-draft__"
          ),
        snapDistance: SNAP_DISTANCE_PX,
        axisSnapDistance: SNAP_DISTANCE_PX,
      });

      return [
        finalizedPoints[0],
        {
          ...finalizedPoints[finalizedPoints.length - 1],
          ...snap.snappedPointer,
        },
      ];
    },
    [
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
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (tool === Tool.Pen) {
        smartAssistController.handlePenPointerDown(point);
      }
      const { color, thickness, shapeFill } = getToolSettings();
      startDrawing();
      drawableSeedRef.current = Date.now();
      strokeIdRef.current = createStrokeId();

      const startPoint = resolveStartSnap(point, shiftKey);
      rawStartPointRef.current = isShapeBoxSnapTool(tool) ? point : null;
      shapeStartSnapRef.current = null;
      pointsRef.current = [startPoint];

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
    [tool, ctxRef, smartAssistController, resolveStartSnap]
  );

  const processPointerMove = useCallback(
    ({ point, shiftKey }: CanvasPointerPayload) => {
      if (!isDrawingRef.current) return;
      const { color, thickness, shapeFill } = getToolSettings();
      const policy = resolveSnapInteractionPolicy({
        mode: "draw",
        tool,
        shiftKey,
      });

      const snap = resolveCreateSnap(point, shiftKey);
      if (snap.startPoint) {
        pointsRef.current[0] = snap.startPoint;
      }
      pointsRef.current.push(snap.point);

      const stroke: Stroke = {
        id: strokeIdRef.current,
        points: pointsRef.current,
        color,
        thickness,
        tool,
        drawableSeed: drawableSeedRef.current,
        isShiftPressed: policy.axisConstraintActive,
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
      const policy = resolveSnapInteractionPolicy({
        mode: "draw",
        tool,
        shiftKey,
      });

      stopDrawing();

      let finalizedPoints = finalizeStrokePoints(
        pointsRef.current,
        tool,
        policy.axisConstraintActive
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
      if (stroke.tool === Tool.Pen) {
        smartAssistController.enqueueCommittedPenStroke(stroke);
      }
      pointsRef.current = [];
      rawStartPointRef.current = null;
      shapeStartSnapRef.current = null;
      strokeIdRef.current = "";
      clearCanvas(ctxRef.current);
    },
    [
      ctxRef,
      flushPendingMove,
      tool,
      withSnappedEndpoint,
      smartAssistController,
    ]
  );

  useEffect(() => {
    return () => {
      if (rafMoveIdRef.current !== null) {
        window.cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }
      pendingMoveRef.current = null;
      rawStartPointRef.current = null;
      shapeStartSnapRef.current = null;
      smartAssistController.dispose();
    };
  }, [smartAssistController]);

  return useMemo(
    () => ({
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp]
  );
};

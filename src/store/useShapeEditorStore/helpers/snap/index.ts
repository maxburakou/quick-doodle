import { getStrokeAABB } from "../core";
import { isShapeBoxTool, Stroke, StrokePoint, Tool } from "@/types";
import { constrainToSquareBounds } from "@/components/Canvas/utils/constrainToSquareBounds";
import {
  AXIS_SNAP_DISTANCE_PX,
  SNAP_DISTANCE_PX,
  SNAP_PRIORITY_ORDER,
} from "@/config/snapConfig";
import { getStrokeAnchorPoints, StrokeAnchorPoint } from "../geometry/anchors";
import { getStrokeContourSegments } from "../geometry/contours";
import { isLineLikeGeometryTool } from "../toolProfile";
import {
  createCanvasBoundaryStroke,
  getStrokeSnapSegments,
  projectPointToSegment,
  type CanvasSnapBounds,
  type PointLike,
  type SnapSegment,
} from "./geometry";
export { getStrokeSnapSegments, getSceneSnapSegments } from "./geometry";
export {
  applySelectResizeGuidePolicy,
  resolveSelectResizeSceneSnapPolicy,
  resolveSnapInteractionPolicy,
  shouldApplyAxisConstraint,
  shouldDisableDrawSnap,
  shouldDisableSelectSnap,
  shouldDisableResizeSnap,
} from "./policy";
export type {
  SnapAxis,
  SnapInteractionMode,
  SnapPolicyDecision,
  SelectResizeGuidePolicyResult,
  SelectResizeSceneSnapPolicy,
} from "./policy";
export {
  getGroupBoundsAnchors,
  pickDiamondCornerAnchors,
  pickEllipseCardinalAnchors,
  pickLineLikeEndpointAnchors,
  pickMoveLikeDrivingAnchors,
  pickRectangleCornerAnchors,
  pickResizeDrivingAnchors,
} from "./selectors";

export type SnapAnchorKind =
  | "corner"
  | "edgeMid"
  | "center"
  | "ellipseAxis"
  | "lineEnd"
  | "lineMid";

export type AxisSnapLine = "x" | "y";
export type AxisSnapKind =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom";

export interface SnapAnchor {
  strokeId: string;
  x: number;
  y: number;
  kind: SnapAnchorKind;
}

export interface AxisSnapCandidate {
  strokeId: string;
  x: number;
  y: number;
  kind: AxisSnapKind;
}

export interface AxisSnapResult {
  snappedX: number;
  snappedY: number;
  snappedAxes: AxisSnapLine[];
  guideX?: number;
  guideY?: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  target: SnapAnchor;
}

export interface SnapComputation {
  point: StrokePoint;
  pointTarget: StrokePoint | null;
  axisSnap: AxisSnapResult | null;
}

export interface SnapSubject {
  // Snap geometry is derived from stroke contour/domain geometry, never from selection UI.
  stroke: Stroke;
  anchors: SnapAnchor[];
  segments: SnapSegment[];
  axisCandidates: AxisSnapCandidate[];
}

export interface InteractionSnapInput {
  rawPointer: StrokePoint;
  sceneContext: {
    anchors: SnapAnchor[];
    segments?: SnapSegment[];
    axisCandidates?: AxisSnapCandidate[];
  };
  buildDraftStroke: (rawPointer: StrokePoint) => Stroke;
  drivingAnchorSelector?: (subject: SnapSubject) => PointLike[];
  snapDistance?: number;
  axisSnapDistance?: number;
}

export interface InteractionSnapResult {
  snappedPointer: StrokePoint;
  pointGuide: StrokePoint | null;
  axisGuide: AxisSnapResult | null;
  draftSubject: SnapSubject;
}

export interface MovingAnchorsSnapInput {
  rawPointer: StrokePoint;
  startPointer: StrokePoint;
  movingAnchors: PointLike[];
  sceneContext: {
    anchors: SnapAnchor[];
    segments?: SnapSegment[];
    axisCandidates?: AxisSnapCandidate[];
  };
  snapDistance?: number;
  axisSnapDistance?: number;
}

export type { SnapSegment } from "./geometry";

export interface SegmentSnapResult {
  snappedX: number;
  snappedY: number;
  target: Pick<StrokePoint, "x" | "y">;
  segment: SnapSegment;
}


interface TranslationSnapResolution {
  delta: { x: number; y: number };
  pointTarget: StrokePoint;
}

interface InteractionSnapCoreInput {
  rawPointer: StrokePoint;
  movingAnchors: PointLike[];
  sceneContext: {
    anchors: SnapAnchor[];
    segments?: SnapSegment[];
    axisCandidates?: AxisSnapCandidate[];
  };
  snapDistance: number;
  axisSnapDistance: number;
}

interface InteractionSnapCoreResult {
  snappedPointer: StrokePoint;
  pointGuide: StrokePoint | null;
  axisGuide: AxisSnapResult | null;
}

interface AxisSnapSelection {
  absDistance: number;
  delta: number;
  guide: number;
}

export const isLineLikeSnapTool = (tool: Tool) =>
  isLineLikeGeometryTool(tool);

export const isShapeBoxSnapTool = (tool: Tool) =>
  isShapeBoxTool(tool);

export const getConstrainedShapeEndpoint = (
  startPoint: StrokePoint,
  point: StrokePoint,
  tool: Tool,
  shiftKey: boolean
): StrokePoint => {
  if (!shiftKey) return point;
  if (!isShapeBoxSnapTool(tool)) return point;

  return constrainToSquareBounds(startPoint, point);
};

const toAnchor = (
  point: PointLike,
  strokeId: string,
  kind: SnapAnchorKind
): SnapAnchor => ({
  strokeId,
  x: point.x,
  y: point.y,
  kind,
});

const mapStrokeAnchorKindToSnapKind = (
  point: StrokeAnchorPoint
): SnapAnchorKind => {
  switch (point.kind) {
    case "corner":
      return "corner";
    case "edgeMid":
      return "edgeMid";
    case "center":
      return "center";
    case "ellipseAxis":
      return "ellipseAxis";
    case "lineEnd":
      return "lineEnd";
    case "lineMid":
      return "lineMid";
    default:
      return "lineMid";
  }
};

const getCanvasSnapAnchors = ({ width, height }: CanvasSnapBounds): SnapAnchor[] => {
  return getStrokeSnapAnchors(createCanvasBoundaryStroke({ width, height }));
};

const getCanvasAxisSnapCandidates = ({
  width,
  height,
}: CanvasSnapBounds): AxisSnapCandidate[] => {
  return getStrokeAxisSnapCandidates(createCanvasBoundaryStroke({ width, height }));
};


export const getStrokeSnapAnchors = (stroke: Stroke): SnapAnchor[] => {
  const points = getStrokeAnchorPoints(stroke, {
    centerMode: "always",
  });

  return points.map((point) =>
    toAnchor(point, stroke.id, mapStrokeAnchorKindToSnapKind(point))
  );
};

export const getSceneSnapAnchors = (
  strokes: Stroke[],
  excludedIds: Set<string>,
  canvasBounds?: CanvasSnapBounds
): SnapAnchor[] => {
  const strokeAnchors = strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeSnapAnchors(stroke));
  if (!canvasBounds) return strokeAnchors;

  return [...strokeAnchors, ...getCanvasSnapAnchors(canvasBounds)];
};

export const getStrokeAxisSnapCandidates = (
  stroke: Stroke
): AxisSnapCandidate[] => {
  const contourBounds = (() => {
    if (stroke.tool === Tool.Pen || stroke.tool === Tool.Text) return null;
    const points = getStrokeContourSegments(stroke).flatMap((segment) => [
      segment.start,
      segment.end,
    ]);
    if (points.length === 0) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  })();
  const bounds = contourBounds ?? getStrokeAABB(stroke);
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  return [
    { strokeId: stroke.id, kind: "left", x: left, y: centerY },
    { strokeId: stroke.id, kind: "centerX", x: centerX, y: centerY },
    { strokeId: stroke.id, kind: "right", x: right, y: centerY },
    { strokeId: stroke.id, kind: "top", x: centerX, y: top },
    { strokeId: stroke.id, kind: "centerY", x: centerX, y: centerY },
    { strokeId: stroke.id, kind: "bottom", x: centerX, y: bottom },
  ];
};

export const getSceneAxisSnapCandidates = (
  strokes: Stroke[],
  excludedIds: Set<string>,
  canvasBounds?: CanvasSnapBounds
): AxisSnapCandidate[] => {
  const strokeCandidates = strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeAxisSnapCandidates(stroke));
  if (!canvasBounds) return strokeCandidates;

  return [...strokeCandidates, ...getCanvasAxisSnapCandidates(canvasBounds)];
};

export const getSnapSubjectFromStroke = (stroke: Stroke): SnapSubject => ({
  stroke,
  anchors: getStrokeSnapAnchors(stroke),
  segments: getStrokeSnapSegments(stroke),
  axisCandidates: getStrokeAxisSnapCandidates(stroke),
});

export const resolveNearestSnap = (
  point: PointLike,
  anchors: SnapAnchor[],
  distance: number = SNAP_DISTANCE_PX
): SnapResult | null => {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPriority = Number.POSITIVE_INFINITY;
  let best: SnapAnchor | null = null;

  for (const anchor of anchors) {
    const dx = anchor.x - point.x;
    const dy = anchor.y - point.y;
    const currentDistance = Math.hypot(dx, dy);

    if (currentDistance > distance) continue;

    const priority = SNAP_PRIORITY_ORDER[anchor.kind];
    const isCloser = currentDistance < bestDistance;
    const isTieWithHigherPriority =
      Math.abs(currentDistance - bestDistance) < 0.001 &&
      priority < bestPriority;

    if (isCloser || isTieWithHigherPriority) {
      best = anchor;
      bestDistance = currentDistance;
      bestPriority = priority;
    }
  }

  if (!best) return null;

  return {
    snappedX: best.x,
    snappedY: best.y,
    target: best,
  };
};

export const resolveNearestSegmentSnap = (
  point: PointLike,
  segments: SnapSegment[],
  distance: number = SNAP_DISTANCE_PX
): SegmentSnapResult | null => {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProjection: PointLike | null = null;
  let bestSegment: SnapSegment | null = null;

  for (const segment of segments) {
    const projected = projectPointToSegment(point, segment.start, segment.end);
    if (projected.distance > distance) continue;
    if (projected.distance >= bestDistance) continue;

    bestDistance = projected.distance;
    bestProjection = projected.projection;
    bestSegment = segment;
  }

  if (!bestProjection || !bestSegment) return null;

  return {
    snappedX: bestProjection.x,
    snappedY: bestProjection.y,
    target: bestProjection,
    segment: bestSegment,
  };
};

export const resolveNearestAxisSnap = (
  movingPoints: PointLike[],
  axisCandidates: AxisSnapCandidate[],
  basePoint: PointLike,
  axisDistance: number = AXIS_SNAP_DISTANCE_PX
): AxisSnapResult | null => {
  let bestX: AxisSnapSelection | null = null;
  let bestY: AxisSnapSelection | null = null;

  for (const movingPoint of movingPoints) {
    for (const candidate of axisCandidates) {
      if (
        candidate.kind === "left" ||
        candidate.kind === "centerX" ||
        candidate.kind === "right"
      ) {
        const deltaX = candidate.x - movingPoint.x;
        const absX = Math.abs(deltaX);
        if (
          absX <= axisDistance &&
          (!bestX || absX < bestX.absDistance)
        ) {
          bestX = {
            absDistance: absX,
            delta: deltaX,
            guide: candidate.x,
          };
        }
      }

      if (
        candidate.kind === "top" ||
        candidate.kind === "centerY" ||
        candidate.kind === "bottom"
      ) {
        const deltaY = candidate.y - movingPoint.y;
        const absY = Math.abs(deltaY);
        if (
          absY <= axisDistance &&
          (!bestY || absY < bestY.absDistance)
        ) {
          bestY = {
            absDistance: absY,
            delta: deltaY,
            guide: candidate.y,
          };
        }
      }
    }
  }

  if (!bestX && !bestY) return null;

  const snappedAxes: AxisSnapLine[] = [];
  if (bestX) snappedAxes.push("x");
  if (bestY) snappedAxes.push("y");

  return {
    snappedX: basePoint.x + (bestX?.delta ?? 0),
    snappedY: basePoint.y + (bestY?.delta ?? 0),
    snappedAxes,
    guideX: bestX?.guide,
    guideY: bestY?.guide,
  };
};

const resolveTranslationSnap = (
  movingPoints: PointLike[],
  anchors: SnapAnchor[],
  snapDistance: number
): TranslationSnapResolution | null => {
  let bestDelta: { x: number; y: number } | null = null;
  let bestTarget: StrokePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const movingPoint of movingPoints) {
    const snapResult = resolveNearestSnap(movingPoint, anchors, snapDistance);
    if (!snapResult) continue;

    const deltaX = snapResult.snappedX - movingPoint.x;
    const deltaY = snapResult.snappedY - movingPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    bestDelta = { x: deltaX, y: deltaY };
    bestTarget = {
      x: snapResult.target.x,
      y: snapResult.target.y,
      pressure: 0.5,
    };
  }

  if (!bestDelta || !bestTarget) return null;

  return {
    delta: bestDelta,
    pointTarget: bestTarget,
  };
};

const resolveTranslationSegmentSnap = (
  movingPoints: PointLike[],
  segments: SnapSegment[],
  snapDistance: number
): TranslationSnapResolution | null => {
  let bestDeltaX = 0;
  let bestDeltaY = 0;
  let bestTarget: StrokePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const movingPoint of movingPoints) {
    for (const segment of segments) {
      const projected = projectPointToSegment(
        movingPoint,
        segment.start,
        segment.end
      );
      if (projected.distance > snapDistance) continue;
      if (projected.distance >= bestDistance) continue;

      bestDistance = projected.distance;
      bestDeltaX = projected.projection.x - movingPoint.x;
      bestDeltaY = projected.projection.y - movingPoint.y;
      bestTarget = {
        x: projected.projection.x,
        y: projected.projection.y,
        pressure: 0.5,
      };
    }
  }

  if (!bestTarget) return null;

  return {
    delta: { x: bestDeltaX, y: bestDeltaY },
    pointTarget: bestTarget,
  };
};

const resolveInteractionSnapCore = ({
  rawPointer,
  movingAnchors,
  sceneContext,
  snapDistance,
  axisSnapDistance,
}: InteractionSnapCoreInput): InteractionSnapCoreResult => {
  const pointSnap = resolveTranslationSnap(
    movingAnchors,
    sceneContext.anchors,
    snapDistance
  );
  if (pointSnap) {
    const snappedPointer = {
      ...rawPointer,
      x: rawPointer.x + pointSnap.delta.x,
      y: rawPointer.y + pointSnap.delta.y,
    };

    return {
      snappedPointer,
      pointGuide: pointSnap.pointTarget,
      axisGuide: null,
    };
  }

  const segmentSnap = resolveTranslationSegmentSnap(
    movingAnchors,
    sceneContext.segments ?? [],
    snapDistance
  );
  if (segmentSnap) {
    const snappedPointer = {
      ...rawPointer,
      x: rawPointer.x + segmentSnap.delta.x,
      y: rawPointer.y + segmentSnap.delta.y,
    };

    return {
      snappedPointer,
      pointGuide: segmentSnap.pointTarget,
      axisGuide: null,
    };
  }

  const axisSnap = resolveNearestAxisSnap(
    movingAnchors,
    sceneContext.axisCandidates ?? [],
    rawPointer,
    axisSnapDistance
  );
  if (!axisSnap) {
    return {
      snappedPointer: rawPointer,
      pointGuide: null,
      axisGuide: null,
    };
  }

  return {
    snappedPointer: {
      ...rawPointer,
      x: axisSnap.snappedX,
      y: axisSnap.snappedY,
    },
    pointGuide: null,
    axisGuide: axisSnap,
  };
};

export const resolveSnapForMovingAnchors = ({
  rawPointer,
  startPointer,
  movingAnchors,
  sceneContext,
  snapDistance = SNAP_DISTANCE_PX,
  axisSnapDistance = AXIS_SNAP_DISTANCE_PX,
}: MovingAnchorsSnapInput): SnapComputation => {
  if (movingAnchors.length === 0) {
    return {
      point: rawPointer,
      pointTarget: null,
      axisSnap: null,
    };
  }

  const rawDx = rawPointer.x - startPointer.x;
  const rawDy = rawPointer.y - startPointer.y;
  const translatedAnchors = movingAnchors.map((sourceAnchor) => ({
    x: sourceAnchor.x + rawDx,
    y: sourceAnchor.y + rawDy,
  }));
  const snapped = resolveInteractionSnapCore({
    rawPointer,
    movingAnchors: translatedAnchors,
    sceneContext,
    snapDistance,
    axisSnapDistance,
  });

  return {
    point: snapped.snappedPointer,
    pointTarget: snapped.pointGuide,
    axisSnap: snapped.axisGuide,
  };
};

export const resolveSnapForInteraction = ({
  rawPointer,
  sceneContext,
  buildDraftStroke,
  drivingAnchorSelector,
  snapDistance = SNAP_DISTANCE_PX,
  axisSnapDistance = AXIS_SNAP_DISTANCE_PX,
}: InteractionSnapInput): InteractionSnapResult => {
  const draftStroke = buildDraftStroke(rawPointer);
  const draftSubject = getSnapSubjectFromStroke(draftStroke);

  const defaultDrivingAnchors = draftSubject.anchors.map((anchor) => ({
    x: anchor.x,
    y: anchor.y,
  }));

  const selectedAnchors = drivingAnchorSelector
    ? drivingAnchorSelector(draftSubject)
    : defaultDrivingAnchors;
  const drivingAnchors =
    selectedAnchors.length > 0 ? selectedAnchors : defaultDrivingAnchors;
  const movingAnchors =
    drivingAnchors.length > 0 ? drivingAnchors : [{ x: rawPointer.x, y: rawPointer.y }];
  const snapped = resolveInteractionSnapCore({
    rawPointer,
    movingAnchors,
    sceneContext,
    snapDistance,
    axisSnapDistance,
  });

  return {
    snappedPointer: snapped.snappedPointer,
    pointGuide: snapped.pointGuide,
    axisGuide: snapped.axisGuide,
    draftSubject,
  };
};

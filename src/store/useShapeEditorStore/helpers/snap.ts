import {
  getBoundsCenter,
  getStrokeBounds,
  getStrokeAABB,
  getStrokeRotation,
  rotatePoint,
} from "./core";
import { isShapeBoxTool, ShapeBoxTool, Stroke, StrokePoint, Tool } from "@/types";
import { constrainToSquareBounds } from "@/components/Canvas/utils/constrainToSquareBounds";
import {
  AXIS_SNAP_DISTANCE_PX,
  SNAP_DISTANCE_PX,
  SNAP_PRIORITY_ORDER,
} from "@/config/snapConfig";
import { getStrokeAnchorPoints, StrokeAnchorPoint } from "./geometryAnchors";

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

export interface SnapSegment {
  strokeId: string;
  start: Pick<StrokePoint, "x" | "y">;
  end: Pick<StrokePoint, "x" | "y">;
  anchorGroup: "boxEdge" | "lineSegment";
}

export interface SegmentSnapResult {
  snappedX: number;
  snappedY: number;
  target: Pick<StrokePoint, "x" | "y">;
  segment: SnapSegment;
}

type PointLike = Pick<StrokePoint, "x" | "y">;
type CanvasSnapBounds = { width: number; height: number };

interface ResolveMoveSnapPointerParams {
  pointer: StrokePoint;
  startPointer: StrokePoint;
  initialCenter?: PointLike;
  movingAnchors?: PointLike[];
  anchors: SnapAnchor[];
  segments?: SnapSegment[];
  axisCandidates?: AxisSnapCandidate[];
  snapDistance?: number;
  axisSnapDistance?: number;
}

interface ResolveShapeCreateEndpointSnapParams {
  startPoint: StrokePoint;
  point: StrokePoint;
  tool: ShapeBoxTool;
  shiftKey: boolean;
  anchors: SnapAnchor[];
  segments?: SnapSegment[];
  axisCandidates?: AxisSnapCandidate[];
  snapDistance?: number;
  axisSnapDistance?: number;
}

interface TranslationSnapResolution {
  delta: { x: number; y: number };
  pointTarget: StrokePoint;
}

interface AxisSnapSelection {
  absDistance: number;
  delta: number;
  guide: number;
}

const X_AXIS_KINDS = new Set<AxisSnapKind>(["left", "centerX", "right"]);
const Y_AXIS_KINDS = new Set<AxisSnapKind>(["top", "centerY", "bottom"]);
const CANVAS_SNAP_ID = "__canvas__";

const createCanvasBoundaryStroke = ({ width, height }: CanvasSnapBounds): Stroke => ({
  id: CANVAS_SNAP_ID,
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: width, y: height, pressure: 0.5 },
  ],
  color: "",
  thickness: 1,
  tool: Tool.Rectangle,
});

export const isLineLikeSnapTool = (tool: Tool) =>
  tool === Tool.Line || tool === Tool.Arrow || tool === Tool.Highlighter;

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

const projectPointToSegment = (
  point: PointLike,
  start: PointLike,
  end: PointLike
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq === 0) {
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    return {
      projection: { x: start.x, y: start.y },
      distance: Math.hypot(deltaX, deltaY),
    };
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSq)
  );
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  const deltaX = point.x - projection.x;
  const deltaY = point.y - projection.y;

  return {
    projection,
    distance: Math.hypot(deltaX, deltaY),
  };
};

const getBoxSnapSegments = (stroke: Stroke): SnapSegment[] => {
  const bounds = stroke.tool === Tool.Pen ? getStrokeAABB(stroke) : getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));

  return [
    {
      strokeId: stroke.id,
      start: corners[0],
      end: corners[1],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[1],
      end: corners[2],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[2],
      end: corners[3],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[3],
      end: corners[0],
      anchorGroup: "boxEdge",
    },
  ];
};

export const getStrokeSnapSegments = (stroke: Stroke): SnapSegment[] => {
  if (isLineLikeSnapTool(stroke.tool)) {
    const points = getStrokeAnchorPoints(stroke, { mode: "lineLike", centerMode: "never" });
    const start = points.find((point) => point.kind === "lineEnd");
    const end = points
      .slice()
      .reverse()
      .find((point) => point.kind === "lineEnd");
    if (!start || !end) return [];

    return [
      {
        strokeId: stroke.id,
        start,
        end,
        anchorGroup: "lineSegment",
      },
    ];
  }

  if (
    stroke.tool === Tool.Rectangle ||
    stroke.tool === Tool.Diamond ||
    stroke.tool === Tool.Ellipse ||
    stroke.tool === Tool.Text ||
    stroke.tool === Tool.Pen
  ) {
    return getBoxSnapSegments(stroke);
  }

  return [];
};

export const getSceneSnapSegments = (
  strokes: Stroke[],
  excludedIds: Set<string>,
  canvasBounds?: CanvasSnapBounds
): SnapSegment[] => {
  const strokeSegments = strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeSnapSegments(stroke));
  if (!canvasBounds) return strokeSegments;

  return [
    ...strokeSegments,
    ...getStrokeSnapSegments(createCanvasBoundaryStroke(canvasBounds)),
  ];
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
  const bounds = getStrokeAABB(stroke);
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
      if (X_AXIS_KINDS.has(candidate.kind)) {
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

      if (Y_AXIS_KINDS.has(candidate.kind)) {
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
  let bestDelta: { x: number; y: number } | null = null;
  let bestTarget: StrokePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const movingPoint of movingPoints) {
    const snapResult = resolveNearestSegmentSnap(movingPoint, segments, snapDistance);
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

export const resolveMoveSnapPointer = ({
  pointer,
  startPointer,
  initialCenter,
  movingAnchors,
  anchors,
  segments = [],
  axisCandidates = [],
  snapDistance = SNAP_DISTANCE_PX,
  axisSnapDistance = AXIS_SNAP_DISTANCE_PX,
}: ResolveMoveSnapPointerParams): SnapComputation => {
  const rawDx = pointer.x - startPointer.x;
  const rawDy = pointer.y - startPointer.y;
  const sourceAnchors =
    movingAnchors && movingAnchors.length > 0
      ? movingAnchors
      : initialCenter
        ? [initialCenter]
        : [];
  const movedAnchors = sourceAnchors.map((sourceAnchor) => ({
    x: sourceAnchor.x + rawDx,
    y: sourceAnchor.y + rawDy,
  }));

  const pointSnap = resolveTranslationSnap(movedAnchors, anchors, snapDistance);
  if (pointSnap) {
    return {
      point: {
        ...pointer,
        x: pointer.x + pointSnap.delta.x,
        y: pointer.y + pointSnap.delta.y,
      },
      pointTarget: pointSnap.pointTarget,
      axisSnap: null,
    };
  }

  const segmentSnap = resolveTranslationSegmentSnap(
    movedAnchors,
    segments,
    snapDistance
  );
  if (segmentSnap) {
    return {
      point: {
        ...pointer,
        x: pointer.x + segmentSnap.delta.x,
        y: pointer.y + segmentSnap.delta.y,
      },
      pointTarget: segmentSnap.pointTarget,
      axisSnap: null,
    };
  }

  const axisSnap = resolveNearestAxisSnap(
    movedAnchors,
    axisCandidates,
    pointer,
    axisSnapDistance
  );
  if (!axisSnap) {
    return {
      point: pointer,
      pointTarget: null,
      axisSnap: null,
    };
  }

  return {
    point: {
      ...pointer,
      x: axisSnap.snappedX,
      y: axisSnap.snappedY,
    },
    pointTarget: null,
    axisSnap,
  };
};

export const resolveLineEndpointSnap = (
  point: StrokePoint,
  anchors: SnapAnchor[],
  axisCandidates: AxisSnapCandidate[] = [],
  distance: number = SNAP_DISTANCE_PX,
  axisSnapDistance: number = AXIS_SNAP_DISTANCE_PX,
  segments: SnapSegment[] = []
): SnapComputation => {
  const pointSnap = resolveNearestSnap(point, anchors, distance);
  if (pointSnap) {
    return {
      point: {
        ...point,
        x: pointSnap.snappedX,
        y: pointSnap.snappedY,
      },
      pointTarget: {
        x: pointSnap.target.x,
        y: pointSnap.target.y,
        pressure: 0.5,
      },
      axisSnap: null,
    };
  }

  const segmentSnap = resolveNearestSegmentSnap(point, segments, distance);
  if (segmentSnap) {
    return {
      point: {
        ...point,
        x: segmentSnap.snappedX,
        y: segmentSnap.snappedY,
      },
      pointTarget: {
        x: segmentSnap.target.x,
        y: segmentSnap.target.y,
        pressure: 0.5,
      },
      axisSnap: null,
    };
  }

  const axisSnap = resolveNearestAxisSnap(
    [point],
    axisCandidates,
    point,
    axisSnapDistance
  );
  if (!axisSnap) {
    return {
      point,
      pointTarget: null,
      axisSnap: null,
    };
  }

  return {
    point: {
      ...point,
      x: axisSnap.snappedX,
      y: axisSnap.snappedY,
    },
    pointTarget: null,
    axisSnap,
  };
};

export const resolveShapeCreateEndpointSnap = ({
  startPoint,
  point,
  tool,
  shiftKey,
  anchors,
  segments = [],
  axisCandidates = [],
  snapDistance = SNAP_DISTANCE_PX,
  axisSnapDistance = AXIS_SNAP_DISTANCE_PX,
}: ResolveShapeCreateEndpointSnapParams): SnapComputation => {
  const effectivePoint = getConstrainedShapeEndpoint(
    startPoint,
    point,
    tool,
    shiftKey
  );
  const draftStroke: Stroke = {
    id: "__draft__",
    points: [startPoint, effectivePoint],
    color: "",
    thickness: 1,
    tool,
  };
  const draftAnchors = getStrokeSnapAnchors(draftStroke);

  const pointSnap = resolveTranslationSnap(draftAnchors, anchors, snapDistance);
  if (pointSnap) {
    const snappedPoint: StrokePoint = {
      ...effectivePoint,
      x: effectivePoint.x + pointSnap.delta.x,
      y: effectivePoint.y + pointSnap.delta.y,
    };
    const finalPoint = getConstrainedShapeEndpoint(
      startPoint,
      snappedPoint,
      tool,
      shiftKey
    );

    return {
      point: finalPoint,
      pointTarget: pointSnap.pointTarget,
      axisSnap: null,
    };
  }

  const segmentSnap = resolveTranslationSegmentSnap(
    draftAnchors,
    segments,
    snapDistance
  );
  if (segmentSnap) {
    const snappedPoint: StrokePoint = {
      ...effectivePoint,
      x: effectivePoint.x + segmentSnap.delta.x,
      y: effectivePoint.y + segmentSnap.delta.y,
    };
    const finalPoint = getConstrainedShapeEndpoint(
      startPoint,
      snappedPoint,
      tool,
      shiftKey
    );

    return {
      point: finalPoint,
      pointTarget: segmentSnap.pointTarget,
      axisSnap: null,
    };
  }

  const axisSnap = resolveNearestAxisSnap(
    draftAnchors,
    axisCandidates,
    effectivePoint,
    axisSnapDistance
  );
  if (!axisSnap) {
    return {
      point: effectivePoint,
      pointTarget: null,
      axisSnap: null,
    };
  }

  const snappedPoint: StrokePoint = {
    ...effectivePoint,
    x: axisSnap.snappedX,
    y: axisSnap.snappedY,
  };
  const finalPoint = getConstrainedShapeEndpoint(
    startPoint,
    snappedPoint,
    tool,
    shiftKey
  );

  return {
    point: finalPoint,
    pointTarget: null,
    axisSnap,
  };
};

import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
} from "./core";
import { Stroke, StrokePoint, Tool } from "@/types";
import { constrainToSquareBounds } from "@/components/Canvas/utils/constrainToSquareBounds";
import {
  AXIS_SNAP_DISTANCE_PX,
  ELLIPSE_ANCHOR_ANGLES,
  SNAP_DISTANCE_PX,
  SNAP_PRIORITY_ORDER,
} from "@/config/snapConfig";

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

type PointLike = Pick<StrokePoint, "x" | "y">;
type LocalAnchor = PointLike & { kind: SnapAnchorKind };

interface ResolveMoveSnapPointerParams {
  pointer: StrokePoint;
  startPointer: StrokePoint;
  initialCenter?: PointLike;
  movingAnchors?: PointLike[];
  anchors: SnapAnchor[];
  axisCandidates?: AxisSnapCandidate[];
  snapDistance?: number;
  axisSnapDistance?: number;
}

interface ResolveShapeCreateEndpointSnapParams {
  startPoint: StrokePoint;
  point: StrokePoint;
  tool: Tool.Rectangle | Tool.Diamond | Tool.Ellipse;
  shiftKey: boolean;
  anchors: SnapAnchor[];
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

export const isLineLikeSnapTool = (tool: Tool) =>
  tool === Tool.Line || tool === Tool.Arrow || tool === Tool.Highlighter;

export const isShapeBoxSnapTool = (tool: Tool) =>
  tool === Tool.Rectangle || tool === Tool.Diamond || tool === Tool.Ellipse;

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

const toWorldAnchor = (
  center: PointLike,
  rotation: number,
  localPoint: PointLike,
  strokeId: string,
  kind: SnapAnchorKind
): SnapAnchor => {
  const worldPoint = rotatePoint(
    {
      x: center.x + localPoint.x,
      y: center.y + localPoint.y,
    },
    center,
    rotation
  );

  return toAnchor(worldPoint, strokeId, kind);
};

const buildBoxLocalAnchors = (halfWidth: number, halfHeight: number): LocalAnchor[] => [
  { x: -halfWidth, y: -halfHeight, kind: "corner" },
  { x: 0, y: -halfHeight, kind: "edgeMid" },
  { x: halfWidth, y: -halfHeight, kind: "corner" },
  { x: halfWidth, y: 0, kind: "edgeMid" },
  { x: halfWidth, y: halfHeight, kind: "corner" },
  { x: 0, y: halfHeight, kind: "edgeMid" },
  { x: -halfWidth, y: halfHeight, kind: "corner" },
  { x: -halfWidth, y: 0, kind: "edgeMid" },
  { x: 0, y: 0, kind: "center" },
];

const buildRotatedAnchors = (
  strokeId: string,
  center: PointLike,
  rotation: number,
  locals: LocalAnchor[]
): SnapAnchor[] =>
  locals.map((local) => toWorldAnchor(center, rotation, local, strokeId, local.kind));

const getRectangleLikeAnchors = (stroke: Stroke): SnapAnchor[] => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  return buildRotatedAnchors(
    stroke.id,
    center,
    rotation,
    buildBoxLocalAnchors(bounds.width / 2, bounds.height / 2)
  );
};

const getDiamondAnchors = (stroke: Stroke): SnapAnchor[] => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);

  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  const locals: LocalAnchor[] = [
    { x: 0, y: -halfHeight, kind: "corner" },
    { x: halfWidth, y: 0, kind: "corner" },
    { x: 0, y: halfHeight, kind: "corner" },
    { x: -halfWidth, y: 0, kind: "corner" },
    { x: halfWidth / 2, y: -halfHeight / 2, kind: "edgeMid" },
    { x: halfWidth / 2, y: halfHeight / 2, kind: "edgeMid" },
    { x: -halfWidth / 2, y: halfHeight / 2, kind: "edgeMid" },
    { x: -halfWidth / 2, y: -halfHeight / 2, kind: "edgeMid" },
    { x: 0, y: 0, kind: "center" },
  ];

  return buildRotatedAnchors(stroke.id, center, rotation, locals);
};

const getEllipseAnchors = (stroke: Stroke): SnapAnchor[] => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);

  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  const anchors = [toAnchor(center, stroke.id, "center")];

  ELLIPSE_ANCHOR_ANGLES.forEach((angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const localPoint = {
      x: Math.cos(angleRad) * halfWidth,
      y: Math.sin(angleRad) * halfHeight,
    };

    anchors.push(
      toWorldAnchor(center, rotation, localPoint, stroke.id, "ellipseAxis")
    );
  });

  return anchors;
};

const getLineAnchors = (stroke: Stroke): SnapAnchor[] => {
  const [start, end] = getStrokeEndpoints(stroke);
  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  return [
    toAnchor(start, stroke.id, "lineEnd"),
    toAnchor(end, stroke.id, "lineEnd"),
    toAnchor(mid, stroke.id, "lineMid"),
  ];
};

const getPenAnchors = (stroke: Stroke): SnapAnchor[] => {
  const bounds = getStrokeAABB(stroke);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  return buildRotatedAnchors(
    stroke.id,
    center,
    0,
    buildBoxLocalAnchors(bounds.width / 2, bounds.height / 2)
  );
};

export const getStrokeSnapAnchors = (stroke: Stroke): SnapAnchor[] => {
  switch (stroke.tool) {
    case Tool.Rectangle:
      return getRectangleLikeAnchors(stroke);
    case Tool.Diamond:
      return getDiamondAnchors(stroke);
    case Tool.Ellipse:
      return getEllipseAnchors(stroke);
    case Tool.Line:
    case Tool.Arrow:
    case Tool.Highlighter:
      return getLineAnchors(stroke);
    case Tool.Text:
      return getRectangleLikeAnchors(stroke);
    case Tool.Pen:
      return getPenAnchors(stroke);
    default:
      return [];
  }
};

export const getSceneSnapAnchors = (
  strokes: Stroke[],
  excludedIds: Set<string>
): SnapAnchor[] =>
  strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeSnapAnchors(stroke));

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
  excludedIds: Set<string>
): AxisSnapCandidate[] =>
  strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeAxisSnapCandidates(stroke));

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

export const resolveMoveSnapPointer = ({
  pointer,
  startPointer,
  initialCenter,
  movingAnchors,
  anchors,
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
  axisSnapDistance: number = AXIS_SNAP_DISTANCE_PX
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

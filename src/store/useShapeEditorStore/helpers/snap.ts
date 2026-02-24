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

export interface SnapAnchor {
  strokeId: string;
  x: number;
  y: number;
  kind: SnapAnchorKind;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  target: SnapAnchor;
}

type PointLike = Pick<StrokePoint, "x" | "y">;
type LocalAnchor = PointLike & { kind: SnapAnchorKind };

interface ResolveMoveSnapPointerParams {
  pointer: StrokePoint;
  startPointer: StrokePoint;
  initialCenter?: PointLike;
  movingAnchors?: PointLike[];
  anchors: SnapAnchor[];
  snapDistance?: number;
}
interface ResolveShapeCreateEndpointSnapParams {
  startPoint: StrokePoint;
  point: StrokePoint;
  tool: Tool.Rectangle | Tool.Diamond | Tool.Ellipse;
  shiftKey: boolean;
  anchors: SnapAnchor[];
  snapDistance?: number;
}
interface TranslationSnapResolution {
  delta: { x: number; y: number };
  target: StrokePoint;
}

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
  const target = best;

  return {
    snappedX: target.x,
    snappedY: target.y,
    target,
  };
};

const resolveTranslationSnap = (
  movingPoints: Array<Pick<StrokePoint, "x" | "y">>,
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
    target: bestTarget,
  };
};

export const resolveMoveSnapPointer = ({
  pointer,
  startPointer,
  initialCenter,
  movingAnchors,
  anchors,
  snapDistance = SNAP_DISTANCE_PX,
}: ResolveMoveSnapPointerParams) => {
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
  const translationSnap = resolveTranslationSnap(
    movedAnchors,
    anchors,
    snapDistance
  );

  if (!translationSnap) {
    return {
      pointer,
      target: null,
    };
  }

  return {
    pointer: {
      ...pointer,
      x: pointer.x + translationSnap.delta.x,
      y: pointer.y + translationSnap.delta.y,
    },
    target: translationSnap.target,
  };
};

export const resolveLineEndpointSnap = (
  point: StrokePoint,
  anchors: SnapAnchor[],
  distance: number = SNAP_DISTANCE_PX
) => {
  const snapResult = resolveNearestSnap(point, anchors, distance);

  if (!snapResult) {
    return {
      point,
      target: null,
    };
  }

  return {
    point: {
      ...point,
      x: snapResult.snappedX,
      y: snapResult.snappedY,
    },
    target: {
      x: snapResult.target.x,
      y: snapResult.target.y,
      pressure: 0.5,
    },
  };
};

export const resolveShapeCreateEndpointSnap = ({
  startPoint,
  point,
  tool,
  shiftKey,
  anchors,
  snapDistance = SNAP_DISTANCE_PX,
}: ResolveShapeCreateEndpointSnapParams) => {
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
  const translationSnap = resolveTranslationSnap(
    draftAnchors,
    anchors,
    snapDistance
  );
  if (!translationSnap) {
    return {
      point: effectivePoint,
      target: null,
    };
  }

  const snappedPoint: StrokePoint = {
    ...effectivePoint,
    x: effectivePoint.x + translationSnap.delta.x,
    y: effectivePoint.y + translationSnap.delta.y,
  };
  const finalPoint = getConstrainedShapeEndpoint(
    startPoint,
    snappedPoint,
    tool,
    shiftKey
  );

  return {
    point: finalPoint,
    target: translationSnap.target,
  };
};

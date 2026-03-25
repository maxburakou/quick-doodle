import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import {
  getStrokeAABB,
  getStrokeEndpoints,
  getStrokeRotation,
  getStrokeTransformBounds,
  inverseRotatePoint,
  rotatePoint,
} from "../core";
import type { PointLike, SnapSegment } from "./geometry";

const RESIZE_SIDE_ANCHOR_COUNT = 3;

interface ResizeAnchorSubject {
  stroke: Stroke;
  anchors: PointLike[];
  segments: SnapSegment[];
}

const MOVE_MID_ANCHOR_EXCLUDED_TOOLS = new Set<Tool>([
  Tool.Arrow,
  Tool.Line,
  Tool.Highlighter,
]);
const LINE_MID_KIND = "lineMid";

interface MoveLikeAnchor extends PointLike {
  kind?: string;
}

export const pickMoveLikeDrivingAnchors = (
  stroke: Stroke,
  anchors: MoveLikeAnchor[]
): PointLike[] => {
  const isMidAnchorExcluded = MOVE_MID_ANCHOR_EXCLUDED_TOOLS.has(stroke.tool);
  return anchors
    .filter((anchor) => !(isMidAnchorExcluded && anchor.kind === LINE_MID_KIND))
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));
};

export const getGroupBoundsAnchors = (strokes: Stroke[]): PointLike[] => {
  if (strokes.length === 0) return [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    const bounds = getStrokeAABB(stroke);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return [
    { x: minX, y: minY },
    { x: centerX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: centerY },
    { x: maxX, y: maxY },
    { x: centerX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: centerY },
    { x: centerX, y: centerY },
  ];
};

const getRotatedBoxCornerAnchors = (stroke: Stroke): PointLike[] => {
  const bounds = getStrokeTransformBounds(stroke);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  return [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ].map((point) => rotatePoint(point, center, rotation));
};

export const pickEllipseCardinalAnchors = (stroke: Stroke): PointLike[] => {
  if (stroke.tool !== Tool.Ellipse) return [];
  return getRotatedBoxCornerAnchors(stroke);
};

export const pickRectangleCornerAnchors = (stroke: Stroke): PointLike[] => {
  if (stroke.tool !== Tool.Rectangle) return [];
  return getRotatedBoxCornerAnchors(stroke);
};

export const pickDiamondCornerAnchors = (stroke: Stroke): PointLike[] => {
  if (stroke.tool !== Tool.Diamond) return [];
  return getRotatedBoxCornerAnchors(stroke);
};

export const pickLineLikeEndpointAnchors = (stroke: Stroke): PointLike[] => {
  if (
    stroke.tool !== Tool.Line &&
    stroke.tool !== Tool.Arrow &&
    stroke.tool !== Tool.Highlighter
  ) {
    return [];
  }

  const [start, end] = getStrokeEndpoints(stroke);
  return [
    { x: start.x, y: start.y },
    { x: end.x, y: end.y },
  ];
};

export const pickResizeDrivingAnchors = (
  subject: ResizeAnchorSubject,
  handle: TransformHandle
): PointLike[] => {
  if (handle === "move") {
    return subject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  }
  if (handle === "rotate") return [];

  if (
    subject.stroke.tool === Tool.Line ||
    subject.stroke.tool === Tool.Arrow ||
    subject.stroke.tool === Tool.Highlighter
  ) {
    const [start, end] = getStrokeEndpoints(subject.stroke);
    if (handle === "nw") return [{ x: start.x, y: start.y }];
    if (handle === "se") return [{ x: end.x, y: end.y }];
    return pickLineLikeEndpointAnchors(subject.stroke);
  }

  const worldAnchors =
    subject.stroke.tool === Tool.Rectangle
      ? pickRectangleCornerAnchors(subject.stroke)
      : subject.stroke.tool === Tool.Ellipse
        ? pickEllipseCardinalAnchors(subject.stroke)
        : subject.stroke.tool === Tool.Diamond
          ? pickDiamondCornerAnchors(subject.stroke)
          : subject.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  if (worldAnchors.length === 0) return [];

  const transformBounds = getStrokeTransformBounds(subject.stroke);
  const center = {
    x: transformBounds.x + transformBounds.width / 2,
    y: transformBounds.y + transformBounds.height / 2,
  };
  const rotation = getStrokeRotation(subject.stroke);

  const localPairs = worldAnchors.map((world) => ({
    world,
    local: inverseRotatePoint(world, center, rotation),
  }));

  const localContourPoints: StrokePoint[] = subject.segments.flatMap((segment) => [
    inverseRotatePoint(segment.start, center, rotation),
    inverseRotatePoint(segment.end, center, rotation),
  ]);
  const localPoints =
    localContourPoints.length > 0 ? localContourPoints : localPairs.map((pair) => pair.local);

  const xValues = localPoints.map((point) => point.x);
  const yValues = localPoints.map((point) => point.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const targetByHandle: Record<
    Exclude<TransformHandle, "move" | "rotate">,
    { x: number; y: number }
  > = {
    nw: { x: minX, y: minY },
    n: { x: centerX, y: minY },
    ne: { x: maxX, y: minY },
    e: { x: maxX, y: centerY },
    se: { x: maxX, y: maxY },
    s: { x: centerX, y: maxY },
    sw: { x: minX, y: maxY },
    w: { x: minX, y: centerY },
  };

  const target = targetByHandle[handle];
  if (!target) {
    return worldAnchors;
  }

  if (
    worldAnchors.length <= 4 &&
    (handle === "n" || handle === "s" || handle === "w" || handle === "e")
  ) {
    const byPrimaryAxis = [...localPairs].sort((a, b) => {
      if (handle === "n" || handle === "s") {
        return handle === "n" ? a.local.y - b.local.y : b.local.y - a.local.y;
      }
      return handle === "w" ? a.local.x - b.local.x : b.local.x - a.local.x;
    });

    const sidePairs = byPrimaryAxis.slice(0, 2);
    if (sidePairs.length > 0) {
      return sidePairs.map((pair) => pair.world);
    }
  }

  if (handle === "nw" || handle === "ne" || handle === "sw" || handle === "se") {
    const closest = localPairs.reduce((best, current) => {
      if (!best) return current;
      const bestDistance = Math.hypot(best.local.x - target.x, best.local.y - target.y);
      const currentDistance = Math.hypot(
        current.local.x - target.x,
        current.local.y - target.y
      );
      return currentDistance < bestDistance ? current : best;
    }, null as (typeof localPairs)[number] | null);

    return closest ? [closest.world] : [];
  }

  const isHorizontalHandle = handle === "n" || handle === "s";
  const sorted = [...localPairs].sort((a, b) => {
    const primaryA = isHorizontalHandle
      ? Math.abs(a.local.y - target.y)
      : Math.abs(a.local.x - target.x);
    const primaryB = isHorizontalHandle
      ? Math.abs(b.local.y - target.y)
      : Math.abs(b.local.x - target.x);
    if (primaryA !== primaryB) return primaryA - primaryB;

    const secondaryA = isHorizontalHandle
      ? Math.abs(a.local.x - target.x)
      : Math.abs(a.local.y - target.y);
    const secondaryB = isHorizontalHandle
      ? Math.abs(b.local.x - target.x)
      : Math.abs(b.local.y - target.y);
    return secondaryA - secondaryB;
  });

  const picks = sorted.slice(0, RESIZE_SIDE_ANCHOR_COUNT).map((pair) => pair.world);
  return picks.length > 0 ? picks : worldAnchors;
};

import { Stroke, Tool, TransformHandle } from "@/types";
import {
  getStrokeAABB,
  getStrokeEndpoints,
  getStrokeRotation,
  getStrokeTransformBounds,
  inverseRotatePoint,
  rotatePoint,
} from "../core";
import type { PointLike } from "./geometry";

const MOVE_MID_ANCHOR_EXCLUDED_TOOLS = new Set<Tool>([
  Tool.Arrow,
  Tool.Line,
  Tool.Highlighter,
]);
const LINE_MID_KIND = "lineMid";

interface ResizeDrivingAnchor extends PointLike {
  kind?: string;
}

interface ResizeDrivingAnchorOptions {
  handle?: TransformHandle;
}

const SIDE_RESIZE_HANDLES = new Set<TransformHandle>(["n", "s", "e", "w"]);
const CORNER_RESIZE_HANDLES = new Set<TransformHandle>(["nw", "ne", "sw", "se"]);
const SIDE_ANCHOR_EPSILON = 0.5;
const LINE_LIKE_TOOLS = new Set<Tool>([Tool.Line, Tool.Arrow, Tool.Highlighter]);

interface LocalizedAnchor {
  world: PointLike;
  local: PointLike;
}

const toLocalizedAnchors = (
  stroke: Stroke,
  anchors: PointLike[]
): LocalizedAnchor[] => {
  const bounds = getStrokeTransformBounds(stroke);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const rotation = getStrokeRotation(stroke);

  return anchors.map((anchor) => ({
    world: anchor,
    local: inverseRotatePoint(anchor, center, rotation),
  }));
};

const pickSideAnchorsForHandle = (
  stroke: Stroke,
  anchors: PointLike[],
  handle: TransformHandle
): PointLike[] => {
  if (!SIDE_RESIZE_HANDLES.has(handle) || anchors.length === 0) {
    return anchors;
  }

  const bounds = getStrokeTransformBounds(stroke);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const rotation = getStrokeRotation(stroke);

  const localAnchors = anchors.map((anchor) => ({
    world: anchor,
    local: inverseRotatePoint(anchor, center, rotation),
  }));

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const anchor of localAnchors) {
    minX = Math.min(minX, anchor.local.x);
    minY = Math.min(minY, anchor.local.y);
    maxX = Math.max(maxX, anchor.local.x);
    maxY = Math.max(maxY, anchor.local.y);
  }

  const sideAnchors = localAnchors.filter((anchor) => {
    if (handle === "n") return Math.abs(anchor.local.y - minY) <= SIDE_ANCHOR_EPSILON;
    if (handle === "s") return Math.abs(anchor.local.y - maxY) <= SIDE_ANCHOR_EPSILON;
    if (handle === "w") return Math.abs(anchor.local.x - minX) <= SIDE_ANCHOR_EPSILON;
    if (handle === "e") return Math.abs(anchor.local.x - maxX) <= SIDE_ANCHOR_EPSILON;
    return true;
  }).map((anchor) => anchor.world);

  return sideAnchors.length > 0 ? sideAnchors : anchors;
};

const pickCornerAnchorForHandle = (
  stroke: Stroke,
  anchors: PointLike[],
  handle: TransformHandle
): PointLike[] => {
  if (!CORNER_RESIZE_HANDLES.has(handle) || anchors.length === 0) {
    return anchors;
  }

  const localized = toLocalizedAnchors(stroke, anchors);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const anchor of localized) {
    minX = Math.min(minX, anchor.local.x);
    minY = Math.min(minY, anchor.local.y);
    maxX = Math.max(maxX, anchor.local.x);
    maxY = Math.max(maxY, anchor.local.y);
  }

  const targetByHandle: Record<
    Extract<TransformHandle, "nw" | "ne" | "sw" | "se">,
    PointLike
  > = {
    nw: { x: minX, y: minY },
    ne: { x: maxX, y: minY },
    sw: { x: minX, y: maxY },
    se: { x: maxX, y: maxY },
  };
  const target = targetByHandle[handle as keyof typeof targetByHandle];
  if (!target) return anchors;

  const closest = localized.reduce((best, current) => {
    if (!best) return current;
    const bestDistance = Math.hypot(best.local.x - target.x, best.local.y - target.y);
    const currentDistance = Math.hypot(
      current.local.x - target.x,
      current.local.y - target.y
    );
    return currentDistance < bestDistance ? current : best;
  }, null as LocalizedAnchor | null);

  return closest ? [closest.world] : anchors;
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
  stroke: Stroke,
  anchors: ResizeDrivingAnchor[],
  options?: ResizeDrivingAnchorOptions
): PointLike[] => {
  const isMidAnchorExcluded = MOVE_MID_ANCHOR_EXCLUDED_TOOLS.has(stroke.tool);
  const filtered = anchors
    .filter((anchor) => !(isMidAnchorExcluded && anchor.kind === LINE_MID_KIND))
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));

  const handle = options?.handle;
  if (!handle) return filtered;

  if (LINE_LIKE_TOOLS.has(stroke.tool)) {
    const [start, end] = pickLineLikeEndpointAnchors(stroke);
    if (handle === "nw" && start) return [start];
    if (handle === "se" && end) return [end];
    return [start, end].filter(Boolean) as PointLike[];
  }

  if (SIDE_RESIZE_HANDLES.has(handle)) {
    return pickSideAnchorsForHandle(stroke, filtered, handle);
  }

  if (CORNER_RESIZE_HANDLES.has(handle)) {
    return pickCornerAnchorForHandle(stroke, filtered, handle);
  }

  return filtered;
};

import { ShapeBounds, Stroke, StrokePoint, Tool } from "@/types";
import { hitTestText } from "@/components/Canvas/utils/textGeometry";
import {
  ACTIVE_ZONE_PX,
  MARQUEE_MAX_SAMPLING_POINTS,
  MARQUEE_SAMPLING_STEP_PX,
} from "@/config/selectionConfig";
import {
  distance,
  distanceToSegment,
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeRotation,
  inverseRotatePoint,
  isEditableShapeTool,
} from "../core";
import { getStrokeContourSegments } from "../geometry/contours";
import { segmentIntersectsRect } from "../geometry/intersections";
import { getToolProfile } from "../toolProfile";

const intersectsBounds = (a: ShapeBounds, b: ShapeBounds) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

const expandBounds = (bounds: ShapeBounds, padding: number): ShapeBounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2,
});

const getBoundsIntersection = (a: ShapeBounds, b: ShapeBounds): ShapeBounds | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;

  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
};

const getMarqueeCorners = (bounds: ShapeBounds): StrokePoint[] => [
  { x: bounds.x, y: bounds.y, pressure: 0.5 },
  { x: bounds.x + bounds.width, y: bounds.y, pressure: 0.5 },
  {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
    pressure: 0.5,
  },
  { x: bounds.x, y: bounds.y + bounds.height, pressure: 0.5 },
];

const getLocalShapeCoordinates = (stroke: Stroke, pointer: StrokePoint) => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const local = inverseRotatePoint(pointer, center, getStrokeRotation(stroke));

  const localX = local.x - center.x;
  const localY = local.y - center.y;
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  if (halfWidth < 1 || halfHeight < 1) return null;

  return {
    localX,
    localY,
    halfWidth,
    halfHeight,
    contourBand: ACTIVE_ZONE_PX,
  };
};

const isPointInRectangleArea = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  tolerance: number
) =>
  Math.abs(localX) <= halfWidth + tolerance &&
  Math.abs(localY) <= halfHeight + tolerance;

const isPointInRectangleBand = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  contourBand: number
) => {
  const outer = isPointInRectangleArea(
    localX,
    localY,
    halfWidth,
    halfHeight,
    contourBand
  );
  if (!outer) return false;

  const innerHalfWidth = Math.max(0, halfWidth - contourBand);
  const innerHalfHeight = Math.max(0, halfHeight - contourBand);
  const insideInner =
    Math.abs(localX) <= innerHalfWidth && Math.abs(localY) <= innerHalfHeight;

  return !insideInner;
};

const getEllipseNormalized = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number
) => {
  if (halfWidth <= 0 || halfHeight <= 0) return Number.POSITIVE_INFINITY;
  return (
    (localX * localX) / (halfWidth * halfWidth) +
    (localY * localY) / (halfHeight * halfHeight)
  );
};

const isPointInEllipseArea = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  tolerance: number
) =>
  getEllipseNormalized(
    localX,
    localY,
    halfWidth + tolerance,
    halfHeight + tolerance
  ) <= 1;

const isPointInEllipseBand = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  contourBand: number
) => {
  const outer = isPointInEllipseArea(
    localX,
    localY,
    halfWidth,
    halfHeight,
    contourBand
  );
  if (!outer) return false;

  const innerHalfWidth = Math.max(0.0001, halfWidth - contourBand);
  const innerHalfHeight = Math.max(0.0001, halfHeight - contourBand);
  const insideInner =
    getEllipseNormalized(localX, localY, innerHalfWidth, innerHalfHeight) <= 1;
  return !insideInner;
};

const getDiamondNormalized = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number
) => {
  if (halfWidth <= 0 || halfHeight <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(localX) / halfWidth + Math.abs(localY) / halfHeight;
};

const isPointInDiamondArea = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  tolerance: number
) =>
  getDiamondNormalized(
    localX,
    localY,
    halfWidth + tolerance,
    halfHeight + tolerance
  ) <= 1;

const isPointInDiamondBand = (
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  contourBand: number
) => {
  const outer = isPointInDiamondArea(
    localX,
    localY,
    halfWidth,
    halfHeight,
    contourBand
  );
  if (!outer) return false;

  const innerHalfWidth = Math.max(0.0001, halfWidth - contourBand);
  const innerHalfHeight = Math.max(0.0001, halfHeight - contourBand);
  const insideInner =
    getDiamondNormalized(localX, localY, innerHalfWidth, innerHalfHeight) <= 1;
  return !insideInner;
};

const isContourShapeTool = (tool: Tool) =>
  tool === Tool.Rectangle || tool === Tool.Diamond || tool === Tool.Ellipse;

const isSegmentDistanceTool = (tool: Tool) =>
  tool === Tool.Pen ||
  tool === Tool.Highlighter ||
  tool === Tool.Line ||
  tool === Tool.Arrow;

const getLineLikeActiveZoneTolerance = (stroke: Stroke) => {
  return getToolProfile(stroke.tool).interactionRadius(stroke.thickness);
};

const getStrokeActiveZonePadding = (stroke: Stroke) => {
  const profile = getToolProfile(stroke.tool);
  const interactionRadius = profile.interactionRadius(stroke.thickness);
  const aabbPadding = profile.aabbPadding(stroke.thickness);

  return Math.max(0, interactionRadius - aabbPadding);
};

const isPointNearContourSegments = (
  point: Pick<StrokePoint, "x" | "y">,
  stroke: Stroke,
  tolerance: number,
  segments = getStrokeContourSegments(stroke)
) => {
  if (segments.length === 0) {
    const firstPoint = stroke.points[0];
    if (!firstPoint) return false;
    return distance(point, firstPoint) <= tolerance;
  }

  return segments.some(
    (segment) => distanceToSegment(point, segment.start, segment.end) <= tolerance
  );
};

const isPointInShapedZone = (stroke: Stroke, pointer: StrokePoint) => {
  if (isSegmentDistanceTool(stroke.tool)) {
    const tolerance = getLineLikeActiveZoneTolerance(stroke);
    return isPointNearContourSegments(pointer, stroke, tolerance);
  }

  const localShape = getLocalShapeCoordinates(stroke, pointer);
  if (!localShape) return false;

  const { localX, localY, halfWidth, halfHeight, contourBand } = localShape;
  const isFilled = Boolean(stroke.shapeFill);

  if (stroke.tool === Tool.Rectangle) {
    return isFilled
      ? isPointInRectangleArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          ACTIVE_ZONE_PX
        )
      : isPointInRectangleBand(
          localX,
          localY,
          halfWidth,
          halfHeight,
          contourBand
        );
  }

  if (stroke.tool === Tool.Ellipse) {
    return isFilled
      ? isPointInEllipseArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          ACTIVE_ZONE_PX
        )
      : isPointInEllipseBand(
          localX,
          localY,
          halfWidth,
          halfHeight,
          contourBand
        );
  }

  if (stroke.tool === Tool.Diamond) {
    return isFilled
      ? isPointInDiamondArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          ACTIVE_ZONE_PX
        )
      : isPointInDiamondBand(
          localX,
          localY,
          halfWidth,
          halfHeight,
          contourBand
        );
  }

  return false;
};

export const isPointInActiveZone = (stroke: Stroke, point: StrokePoint): boolean => {
  if (!isEditableShapeTool(stroke.tool)) return false;

  if (stroke.tool === Tool.Text) {
    return hitTestText(stroke, point, ACTIVE_ZONE_PX);
  }

  return isPointInShapedZone(stroke, point);
};

const sampleIntersectionWithActiveZone = (stroke: Stroke, area: ShapeBounds) => {
  let checks = 0;
  const maxX = area.x + area.width;
  const maxY = area.y + area.height;

  for (
    let y = area.y;
    y <= maxY && checks < MARQUEE_MAX_SAMPLING_POINTS;
    y += MARQUEE_SAMPLING_STEP_PX
  ) {
    for (
      let x = area.x;
      x <= maxX && checks < MARQUEE_MAX_SAMPLING_POINTS;
      x += MARQUEE_SAMPLING_STEP_PX
    ) {
      checks += 1;
      if (isPointInActiveZone(stroke, { x, y, pressure: 0.5 })) {
        return true;
      }
    }
  }

  return false;
};

export const doesActiveZoneIntersectRect = (
  stroke: Stroke,
  rect: ShapeBounds
): boolean => {
  const activeAABB = expandBounds(
    getStrokeAABB(stroke),
    getStrokeActiveZonePadding(stroke)
  );
  if (!intersectsBounds(activeAABB, rect)) return false;

  const contourSegments = getStrokeContourSegments(stroke);
  if (
    contourSegments.some((segment) =>
      segmentIntersectsRect(segment.start, segment.end, rect)
    )
  ) {
    return true;
  }

  const rectCorners = getMarqueeCorners(rect);
  if (isContourShapeTool(stroke.tool) && !stroke.shapeFill) {
    const tolerance = getLineLikeActiveZoneTolerance(stroke);
    if (
      rectCorners.some((corner) =>
        isPointNearContourSegments(corner, stroke, tolerance, contourSegments)
      )
    ) {
      return true;
    }
  } else if (rectCorners.some((corner) => isPointInActiveZone(stroke, corner))) {
    return true;
  }

  const intersection = getBoundsIntersection(activeAABB, rect);
  if (!intersection) return false;

  return sampleIntersectionWithActiveZone(stroke, intersection);
};

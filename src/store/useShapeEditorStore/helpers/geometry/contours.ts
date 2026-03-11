import {
  CONTOUR_CACHE_MAX_SIZE,
  ELLIPSE_CONTOUR_SEGMENTS,
  PEN_MAX_CONTOUR_SEGMENTS,
} from "@/config/contourConfig";
import { Stroke, StrokePoint, Tool } from "@/types";
import { getCachedPenPolygon } from "@/components/Canvas/utils/strokeShapeCache";
import {
  getBoundsCenter,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
  distanceToSegment,
} from "../core";
import { isLineLikeGeometryTool } from "../toolProfile";

export type ContourSegmentGroup = "boxEdge" | "lineSegment";

export interface ContourSegment {
  start: Pick<StrokePoint, "x" | "y">;
  end: Pick<StrokePoint, "x" | "y">;
  group: ContourSegmentGroup;
}

export interface StrokeContourPolicy {
  ellipseSegments?: number;
  penMaxSegments?: number;
}

const contourSegmentsCache = new Map<string, ContourSegment[]>();

const simplifyPoints = (
  points: StrokePoint[],
  epsilon: number
): StrokePoint[] => {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    if (!start || !end || !point) continue;
    
    const d = distanceToSegment(point, start, end);
    if (d > maxDistance) {
      index = i;
      maxDistance = d;
    }
  }

  if (maxDistance > epsilon) {
    const returnPoints1 = simplifyPoints(points.slice(0, index + 1), epsilon);
    const returnPoints2 = simplifyPoints(points.slice(index), epsilon);
    return returnPoints1.slice(0, -1).concat(returnPoints2);
  }

  if (!start || !end) return points;
  return [start, end];
};

const toPolylinePoints = (
  points: StrokePoint[],
  maxSegments: number
): StrokePoint[] => {
  if (points.length <= 2) return points;
  
  const epsilon = Math.max(0.5, points.length / (maxSegments * 2));
  const simplified = simplifyPoints(points, epsilon);
  
  if (simplified.length > maxSegments + 1) {
    const stride = Math.ceil(simplified.length / maxSegments);
    return simplified.filter((_, i, arr) => i % stride === 0 || i === arr.length - 1);
  }
  
  return simplified;
};

const buildSegmentsFromOrderedPoints = (
  points: Array<Pick<StrokePoint, "x" | "y">>,
  group: ContourSegmentGroup,
  closeLoop: boolean
): ContourSegment[] => {
  if (points.length < 2) return [];

  const segments: ContourSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) continue;
    segments.push({ start, end, group });
  }

  if (closeLoop) {
    const start = points[points.length - 1];
    const end = points[0];
    if (start && end) {
      segments.push({ start, end, group });
    }
  }

  return segments;
};

export const getRectangleContourPoints = (stroke: Stroke) => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);

  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));
};

export const getDiamondContourPoints = (stroke: Stroke) => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  return [
    { x: center.x, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y },
    { x: center.x, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y },
  ].map((point) => rotatePoint(point, center, rotation));
};

export const getEllipseContourPoints = (
  stroke: Stroke,
  ellipseSegments: number = ELLIPSE_CONTOUR_SEGMENTS
) => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const count = Math.max(8, ellipseSegments);

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const point = {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight,
      pressure: 0.5,
    };
    return rotatePoint(point, center, rotation);
  });
};

export const getPenContourPoints = (
  stroke: Stroke,
  maxSegments: number = PEN_MAX_CONTOUR_SEGMENTS
) => {
  if (stroke.points.length < 2) return [];

  const polygon = getCachedPenPolygon(stroke);
  if (!polygon || polygon.length === 0) return [];

  const polygonPoints: StrokePoint[] = polygon.map((p) => ({
    x: p[0],
    y: p[1],
    pressure: 0.5,
  }));

  return toPolylinePoints(polygonPoints, maxSegments);
};

const toContourCacheKey = (stroke: Stroke, policy?: StrokeContourPolicy) => {
  const firstPoint = stroke.points[0];
  const middlePoint =
    stroke.points.length > 0
      ? stroke.points[Math.floor(stroke.points.length / 2)]
      : undefined;
  const lastPoint = stroke.points[stroke.points.length - 1];
  const shapeFillKey = stroke.shapeFill
    ? `1:${stroke.shapeFill.style ?? ""}:${stroke.shapeFill.color}`
    : "0::";

  return [
    stroke.id,
    stroke.tool,
    stroke.points.length,
    firstPoint ? `${firstPoint.x},${firstPoint.y}` : "none",
    middlePoint ? `${middlePoint.x},${middlePoint.y}` : "none",
    lastPoint ? `${lastPoint.x},${lastPoint.y}` : "none",
    stroke.thickness,
    stroke.rotation ?? 0,
    stroke.isShiftPressed ? 1 : 0,
    shapeFillKey,
    policy?.ellipseSegments ?? ELLIPSE_CONTOUR_SEGMENTS,
    policy?.penMaxSegments ?? PEN_MAX_CONTOUR_SEGMENTS,
  ].join("|");
};

const setCachedContourSegments = (key: string, segments: ContourSegment[]) => {
  contourSegmentsCache.set(key, segments);

  if (contourSegmentsCache.size <= CONTOUR_CACHE_MAX_SIZE) {
    return;
  }

  const oldestKey = contourSegmentsCache.keys().next().value;
  if (typeof oldestKey === "string") {
    contourSegmentsCache.delete(oldestKey);
  }
};

const computeStrokeContourSegments = (
  stroke: Stroke,
  policy?: StrokeContourPolicy
): ContourSegment[] => {
  if (isLineLikeGeometryTool(stroke.tool)) {
    const [start, end] = getStrokeEndpoints(stroke);
    return [{ start, end, group: "lineSegment" }];
  }

  if (stroke.tool === Tool.Pen) {
    const maxSegments = policy?.penMaxSegments ?? PEN_MAX_CONTOUR_SEGMENTS;
    return buildSegmentsFromOrderedPoints(
      getPenContourPoints(stroke, maxSegments),
      "lineSegment",
      true
    );
  }

  if (stroke.tool === Tool.Diamond) {
    return buildSegmentsFromOrderedPoints(
      getDiamondContourPoints(stroke),
      "boxEdge",
      true
    );
  }

  if (stroke.tool === Tool.Ellipse) {
    const ellipseSegments = policy?.ellipseSegments ?? ELLIPSE_CONTOUR_SEGMENTS;
    return buildSegmentsFromOrderedPoints(
      getEllipseContourPoints(stroke, ellipseSegments),
      "boxEdge",
      true
    );
  }

  return buildSegmentsFromOrderedPoints(
    getRectangleContourPoints(stroke),
    "boxEdge",
    true
  );
};

export const getStrokeContourSegments = (
  stroke: Stroke,
  policy?: StrokeContourPolicy
): ContourSegment[] => {
  const key = toContourCacheKey(stroke, policy);
  const cached = contourSegmentsCache.get(key);
  if (cached) {
    return cached;
  }

  const segments = computeStrokeContourSegments(stroke, policy);
  setCachedContourSegments(key, segments);

  return segments;
};

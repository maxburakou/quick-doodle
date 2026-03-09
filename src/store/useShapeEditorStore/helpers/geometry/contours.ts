import {
  CONTOUR_CACHE_MAX_SIZE,
  ELLIPSE_CONTOUR_SEGMENTS,
  PEN_MAX_CONTOUR_SEGMENTS,
} from "@/config/contourConfig";
import { Stroke, StrokePoint, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
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

const toPolylinePoints = (
  points: StrokePoint[],
  maxSegments: number
): StrokePoint[] => {
  if (points.length <= 2) return points;

  const rawSegments = points.length - 1;
  const stride = Math.max(1, Math.ceil(rawSegments / maxSegments));
  const output: StrokePoint[] = [];

  for (let index = 0; index < points.length; index += stride) {
    const point = points[index];
    if (!point) continue;
    output.push(point);
  }

  const last = points[points.length - 1];
  const outLast = output[output.length - 1];
  if (last && (!outLast || outLast.x !== last.x || outLast.y !== last.y)) {
    output.push(last);
  }

  return output;
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
  return toPolylinePoints(stroke.points, maxSegments);
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
      false
    );
  }

  if (stroke.tool === Tool.Rectangle || stroke.tool === Tool.Text) {
    return buildSegmentsFromOrderedPoints(
      getRectangleContourPoints(stroke),
      "boxEdge",
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

  const bounds = getStrokeAABB(stroke);
  const points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  return buildSegmentsFromOrderedPoints(points, "boxEdge", true);
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

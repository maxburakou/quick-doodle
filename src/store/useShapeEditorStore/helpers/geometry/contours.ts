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

const DEFAULT_ELLIPSE_SEGMENTS = 24;
const DEFAULT_PEN_MAX_SEGMENTS = 256;

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

const getRectangleCorners = (stroke: Stroke) => {
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

const getDiamondCorners = (stroke: Stroke) => {
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

const getEllipsePolyline = (stroke: Stroke, segments: number) => {
  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const count = Math.max(8, segments);

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

const getPenPolyline = (stroke: Stroke, maxSegments: number) => {
  const source = stroke.points;
  if (source.length < 2) return [];
  return toPolylinePoints(source, maxSegments);
};

export const getStrokeContourSegments = (
  stroke: Stroke,
  policy?: StrokeContourPolicy
): ContourSegment[] => {
  if (isLineLikeGeometryTool(stroke.tool)) {
    const [start, end] = getStrokeEndpoints(stroke);
    return [{ start, end, group: "lineSegment" }];
  }

  if (stroke.tool === Tool.Pen) {
    const maxSegments = policy?.penMaxSegments ?? DEFAULT_PEN_MAX_SEGMENTS;
    const polyline = getPenPolyline(stroke, maxSegments);
    return buildSegmentsFromOrderedPoints(polyline, "lineSegment", false);
  }

  if (stroke.tool === Tool.Rectangle || stroke.tool === Tool.Text) {
    return buildSegmentsFromOrderedPoints(
      getRectangleCorners(stroke),
      "boxEdge",
      true
    );
  }

  if (stroke.tool === Tool.Diamond) {
    return buildSegmentsFromOrderedPoints(
      getDiamondCorners(stroke),
      "boxEdge",
      true
    );
  }

  if (stroke.tool === Tool.Ellipse) {
    const ellipseSegments = policy?.ellipseSegments ?? DEFAULT_ELLIPSE_SEGMENTS;
    return buildSegmentsFromOrderedPoints(
      getEllipsePolyline(stroke, ellipseSegments),
      "boxEdge",
      true
    );
  }

  // Fallback to AABB for unknown editable shapes.
  const bounds = getStrokeAABB(stroke);
  const points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  return buildSegmentsFromOrderedPoints(points, "boxEdge", true);
};

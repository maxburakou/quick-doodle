import {
  EditableShapeTool,
  ShapeBounds,
  Stroke,
  StrokePoint,
  Tool,
} from "@/types";
import { constrainLineToAxis } from "@/components/Canvas/utils/constrainLineToAxis";
import { constrainToSquareBounds } from "@/components/Canvas/utils/constrainToSquareBounds";
import { normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";

const EDITABLE_SHAPE_TOOLS: EditableShapeTool[] = [
  Tool.Pen,
  Tool.Highlighter,
  Tool.Text,
  Tool.Arrow,
  Tool.Line,
  Tool.Rectangle,
  Tool.Diamond,
  Tool.Ellipse,
];

export const createStrokeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const isEditableShapeTool = (tool: Tool): tool is EditableShapeTool =>
  EDITABLE_SHAPE_TOOLS.includes(tool as EditableShapeTool);

export const getStrokeRotation = (stroke: Stroke) => stroke.rotation ?? 0;

export const getStrokeEndpoints = (stroke: Stroke): [StrokePoint, StrokePoint] => {
  if (stroke.tool === Tool.Text && stroke.text) {
    const normalizedStroke = normalizeTextStroke(stroke);
    const start = normalizedStroke.points[0];
    const end = normalizedStroke.points[1] ?? start;
    return [start, end];
  }

  const start = stroke.points[0];
  const rawEnd = stroke.points[stroke.points.length - 1] ?? start;

  if (!stroke.isShiftPressed) {
    return [start, rawEnd];
  }

  if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    return [start, constrainLineToAxis(start, rawEnd, 15)];
  }

  if (
    stroke.tool === Tool.Rectangle ||
    stroke.tool === Tool.Ellipse ||
    stroke.tool === Tool.Diamond
  ) {
    return [start, constrainToSquareBounds(start, rawEnd)];
  }

  return [start, rawEnd];
};

export const normalizeBoundsFromPoints = (
  start: StrokePoint,
  end: StrokePoint
): ShapeBounds => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const getStrokeBounds = (stroke: Stroke): ShapeBounds => {
  const [start, end] = getStrokeEndpoints(stroke);
  return normalizeBoundsFromPoints(start, end);
};

const getPenStrokeBounds = (stroke: Stroke): ShapeBounds => {
  const firstPoint = stroke.points[0] ?? { x: 0, y: 0 };
  let minX = firstPoint.x;
  let maxX = firstPoint.x;
  let minY = firstPoint.y;
  let maxY = firstPoint.y;

  stroke.points.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });

  const padding =
    stroke.tool === Tool.Highlighter
      ? Math.max(6, stroke.thickness * 1.25)
      : Math.max(6, stroke.thickness * 2);

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

const getRotatedAABB = (bounds: ShapeBounds, rotation: number): ShapeBounds => {
  if (rotation === 0) return bounds;

  const center = getBoundsCenter(bounds);
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const getStrokeAABB = (stroke: Stroke): ShapeBounds => {
  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) {
    return getPenStrokeBounds(stroke);
  }

  const bounds = getStrokeBounds(stroke);
  return getRotatedAABB(bounds, getStrokeRotation(stroke));
};

export const getBoundsCenter = (bounds: ShapeBounds) => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

export const rotatePoint = (
  point: Pick<StrokePoint, "x" | "y">,
  center: Pick<StrokePoint, "x" | "y">,
  angle: number
): StrokePoint => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
    pressure: 0.5,
  };
};

export const inverseRotatePoint = (
  point: Pick<StrokePoint, "x" | "y">,
  center: Pick<StrokePoint, "x" | "y">,
  angle: number
): StrokePoint => rotatePoint(point, center, -angle);

export const distance = (
  a: Pick<StrokePoint, "x" | "y">,
  b: Pick<StrokePoint, "x" | "y">
) => Math.hypot(a.x - b.x, a.y - b.y);

export const distanceToSegment = (
  point: Pick<StrokePoint, "x" | "y">,
  start: Pick<StrokePoint, "x" | "y">,
  end: Pick<StrokePoint, "x" | "y">
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) return distance(point, start);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
    )
  );

  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return distance(point, projection);
};

export const withStrokeEndpoints = (
  stroke: Stroke,
  start: StrokePoint,
  end: StrokePoint
): Stroke => {
  const firstPoint = stroke.points[0];
  const lastPoint = stroke.points[stroke.points.length - 1] ?? firstPoint;

  const nextStart = {
    ...start,
    pressure: firstPoint?.pressure ?? start.pressure ?? 0.5,
  };
  const nextEnd = {
    ...end,
    pressure: lastPoint?.pressure ?? end.pressure ?? 0.5,
  };

  return {
    ...stroke,
    points: [nextStart, nextEnd],
  };
};

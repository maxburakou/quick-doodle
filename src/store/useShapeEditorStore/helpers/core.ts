import {
  EditableShapeTool,
  ShapeBounds,
  Stroke,
  StrokePoint,
  Tool,
} from "@/types";
import { constrainLineToAxis } from "@/components/Canvas/utils/constrainLineToAxis";
import { constrainToSquareBounds } from "@/components/Canvas/utils/constrainToSquareBounds";

const EDITABLE_SHAPE_TOOLS: EditableShapeTool[] = [
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

import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import {
  distance,
  distanceToSegment,
  getBoundsCenter,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  inverseRotatePoint,
  isEditableShapeTool,
  rotatePoint,
} from "./core";

const HANDLE_RADIUS = 8;
const ROTATE_HANDLE_OFFSET = 28;
const HIT_TOLERANCE = 8;

export interface TransformHandlePoint {
  handle: TransformHandle;
  point: StrokePoint;
}

const getLineRotateHandleSide = (
  start: StrokePoint,
  end: StrokePoint
): 1 | -1 => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  const normalA = {
    x: -dy / length,
    y: dx / length,
  };

  const centerY = (start.y + end.y) / 2;
  const handleAY = centerY + normalA.y * ROTATE_HANDLE_OFFSET;
  const handleBY = centerY - normalA.y * ROTATE_HANDLE_OFFSET;

  return handleAY <= handleBY ? 1 : -1;
};

export const getStrokeLineRotateHandleSide = (stroke: Stroke): 1 | -1 => {
  const [start, end] = getStrokeEndpoints(stroke);
  return getLineRotateHandleSide(start, end);
};

export const getStrokeTransformHandles = (
  stroke: Stroke,
  lineRotateHandleSide?: 1 | -1
): TransformHandlePoint[] => {
  if (!isEditableShapeTool(stroke.tool)) return [];

  const [start, end] = getStrokeEndpoints(stroke);

  if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      pressure: 0.5,
    };

    const directionX = end.x - start.x;
    const directionY = end.y - start.y;
    const length = Math.hypot(directionX, directionY) || 1;
    const side = lineRotateHandleSide ?? getLineRotateHandleSide(start, end);

    const normal = {
      x: (-directionY / length) * side,
      y: (directionX / length) * side,
    };

    const rotateHandle = {
      x: center.x + normal.x * ROTATE_HANDLE_OFFSET,
      y: center.y + normal.y * ROTATE_HANDLE_OFFSET,
      pressure: 0.5,
    };

    return [
      { handle: "nw", point: start },
      { handle: "se", point: end },
      { handle: "rotate", point: rotateHandle },
    ];
  }

  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);

  const rawHandles: TransformHandlePoint[] = [
    { handle: "nw", point: { x: bounds.x, y: bounds.y, pressure: 0.5 } },
    {
      handle: "n",
      point: { x: bounds.x + bounds.width / 2, y: bounds.y, pressure: 0.5 },
    },
    {
      handle: "ne",
      point: { x: bounds.x + bounds.width, y: bounds.y, pressure: 0.5 },
    },
    {
      handle: "e",
      point: {
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height / 2,
        pressure: 0.5,
      },
    },
    {
      handle: "se",
      point: {
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height,
        pressure: 0.5,
      },
    },
    {
      handle: "s",
      point: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height,
        pressure: 0.5,
      },
    },
    {
      handle: "sw",
      point: { x: bounds.x, y: bounds.y + bounds.height, pressure: 0.5 },
    },
    {
      handle: "w",
      point: { x: bounds.x, y: bounds.y + bounds.height / 2, pressure: 0.5 },
    },
    {
      handle: "rotate",
      point: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y - ROTATE_HANDLE_OFFSET,
        pressure: 0.5,
      },
    },
  ];

  return rawHandles.map((entry) => ({
    ...entry,
    point: rotatePoint(entry.point, center, rotation),
  }));
};

export const getHandleAtPointer = (
  stroke: Stroke,
  pointer: StrokePoint,
  radius: number = HANDLE_RADIUS,
  lineRotateHandleSide?: 1 | -1
): TransformHandle | null => {
  const handles = getStrokeTransformHandles(stroke, lineRotateHandleSide);

  for (const { handle, point } of handles) {
    if (distance(pointer, point) <= radius) return handle;
  }

  return null;
};

const hitTestLineLikeStroke = (stroke: Stroke, pointer: StrokePoint) => {
  const [start, end] = getStrokeEndpoints(stroke);
  return (
    distanceToSegment(pointer, start, end) <=
    Math.max(HIT_TOLERANCE, stroke.thickness + 2)
  );
};

export const hitTestStroke = (stroke: Stroke, pointer: StrokePoint) => {
  if (!isEditableShapeTool(stroke.tool)) return false;

  if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    return hitTestLineLikeStroke(stroke, pointer);
  }

  const bounds = getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const local = inverseRotatePoint(pointer, center, getStrokeRotation(stroke));

  const localX = local.x - center.x;
  const localY = local.y - center.y;

  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  if (halfWidth < 1 || halfHeight < 1) return false;

  if (stroke.tool === Tool.Rectangle) {
    return (
      Math.abs(localX) <= halfWidth + HIT_TOLERANCE &&
      Math.abs(localY) <= halfHeight + HIT_TOLERANCE
    );
  }

  if (stroke.tool === Tool.Ellipse) {
    const normalized =
      (localX * localX) /
        ((halfWidth + HIT_TOLERANCE) * (halfWidth + HIT_TOLERANCE)) +
      (localY * localY) /
        ((halfHeight + HIT_TOLERANCE) * (halfHeight + HIT_TOLERANCE));
    return normalized <= 1;
  }

  if (stroke.tool === Tool.Diamond) {
    const normalized =
      Math.abs(localX) / (halfWidth + HIT_TOLERANCE) +
      Math.abs(localY) / (halfHeight + HIT_TOLERANCE);
    return normalized <= 1;
  }

  return false;
};

export const getTopMostStrokeAtPointer = (
  strokes: Stroke[],
  pointer: StrokePoint
): Stroke | null => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (!stroke) continue;
    if (hitTestStroke(stroke, pointer)) {
      return stroke;
    }
  }

  return null;
};

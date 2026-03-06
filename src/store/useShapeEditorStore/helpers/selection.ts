import { isShapeBoxTool, Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
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
import { hitTestText } from "@/components/Canvas/utils/textGeometry";

const HANDLE_RADIUS = 8;
const ROTATE_HANDLE_OFFSET = 28;
const HIT_TOLERANCE = 8;

export interface TransformHandlePoint {
  handle: TransformHandle;
  point: StrokePoint;
}

export const getStrokeTransformHandles = (
  stroke: Stroke
): TransformHandlePoint[] => {
  if (!isEditableShapeTool(stroke.tool)) return [];
  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) return [];

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

    const normal = {
      x: -directionY / length,
      y: directionX / length,
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

  if (stroke.tool === Tool.Text) {
    const textHandles: TransformHandlePoint[] = [
      { handle: "nw", point: { x: bounds.x, y: bounds.y, pressure: 0.5 } },
      {
        handle: "ne",
        point: { x: bounds.x + bounds.width, y: bounds.y, pressure: 0.5 },
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
        handle: "sw",
        point: { x: bounds.x, y: bounds.y + bounds.height, pressure: 0.5 },
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

    return textHandles.map((entry) => ({
      ...entry,
      point: rotatePoint(entry.point, center, rotation),
    }));
  }

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
  radius: number = HANDLE_RADIUS
): TransformHandle | null => {
  const handles = getStrokeTransformHandles(stroke);

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

const hitTestPenStroke = (stroke: Stroke, pointer: StrokePoint) => {
  const points = stroke.points;
  if (points.length === 0) return false;
  if (points.length === 1) return distance(pointer, points[0]) <= HIT_TOLERANCE;

  const threshold = Math.max(HIT_TOLERANCE, stroke.thickness + 2);

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next) continue;
    if (distanceToSegment(pointer, current, next) <= threshold) {
      return true;
    }
  }

  return false;
};

export const isUnfilledClosedShape = (stroke: Stroke) =>
  isShapeBoxTool(stroke.tool) && !stroke.shapeFill;

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
  return (localX * localX) / (halfWidth * halfWidth) + (localY * localY) / (halfHeight * halfHeight);
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
    contourBand: Math.max(HIT_TOLERANCE, stroke.thickness + 2),
  };
};

export const isInteriorHitForClosedShape = (
  stroke: Stroke,
  pointer: StrokePoint
) => {
  if (!isUnfilledClosedShape(stroke)) return false;

  const localShape = getLocalShapeCoordinates(stroke, pointer);
  if (!localShape) return false;

  const { localX, localY, halfWidth, halfHeight, contourBand } = localShape;

  if (stroke.tool === Tool.Rectangle) {
    return (
      isPointInRectangleArea(localX, localY, halfWidth, halfHeight, HIT_TOLERANCE) &&
      !isPointInRectangleBand(localX, localY, halfWidth, halfHeight, contourBand)
    );
  }

  if (stroke.tool === Tool.Ellipse) {
    return (
      isPointInEllipseArea(localX, localY, halfWidth, halfHeight, HIT_TOLERANCE) &&
      !isPointInEllipseBand(localX, localY, halfWidth, halfHeight, contourBand)
    );
  }

  if (stroke.tool === Tool.Diamond) {
    return (
      isPointInDiamondArea(localX, localY, halfWidth, halfHeight, HIT_TOLERANCE) &&
      !isPointInDiamondBand(localX, localY, halfWidth, halfHeight, contourBand)
    );
  }

  return false;
};

export const hitTestStroke = (stroke: Stroke, pointer: StrokePoint) => {
  if (!isEditableShapeTool(stroke.tool)) return false;

  if (stroke.tool === Tool.Pen) {
    return hitTestPenStroke(stroke, pointer);
  }

  if (stroke.tool === Tool.Highlighter) {
    const threshold = Math.max(HIT_TOLERANCE, stroke.thickness * 2.5);
    const [start, end] = getStrokeEndpoints(stroke);
    return distanceToSegment(pointer, start, end) <= threshold;
  }

  if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    return hitTestLineLikeStroke(stroke, pointer);
  }

  if (stroke.tool === Tool.Text && stroke.text) {
    return hitTestText(stroke, pointer, HIT_TOLERANCE);
  }

  const localShape = getLocalShapeCoordinates(stroke, pointer);
  if (!localShape) return false;
  const { localX, localY, halfWidth, halfHeight, contourBand } = localShape;
  const isFilledClosedShape = Boolean(stroke.shapeFill);

  if (stroke.tool === Tool.Rectangle) {
    return isFilledClosedShape
      ? isPointInRectangleArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          HIT_TOLERANCE
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
    return isFilledClosedShape
      ? isPointInEllipseArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          HIT_TOLERANCE
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
    return isFilledClosedShape
      ? isPointInDiamondArea(
          localX,
          localY,
          halfWidth,
          halfHeight,
          HIT_TOLERANCE
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

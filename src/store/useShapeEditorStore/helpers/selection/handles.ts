import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import {
  distance,
  getBoundsCenter,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  getStrokeTransformBounds,
  isEditableShapeTool,
  rotatePoint,
} from "../core";
import { isLineLikeGeometryTool } from "../toolProfile";

const HANDLE_RADIUS = 8;
const ROTATE_HANDLE_OFFSET = 28;

export interface TransformHandlePoint {
  handle: TransformHandle;
  point: StrokePoint;
}

export type TransformHandleMode = "transform" | "selection";

const getHandleBounds = (stroke: Stroke, mode: TransformHandleMode) =>
  mode === "transform" ? getStrokeTransformBounds(stroke) : getStrokeBounds(stroke);

export const getStrokeTransformHandles = (
  stroke: Stroke,
  mode: TransformHandleMode = "selection"
): TransformHandlePoint[] => {
  if (!isEditableShapeTool(stroke.tool)) return [];
  if (stroke.tool === Tool.Pen) return [];

  const [start, end] = getStrokeEndpoints(stroke);

  if (isLineLikeGeometryTool(stroke.tool)) {
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

  const bounds = getHandleBounds(stroke, mode);
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
  radius: number = HANDLE_RADIUS,
  mode: TransformHandleMode = "selection"
): TransformHandle | null => {
  const handles = getStrokeTransformHandles(stroke, mode);

  for (const { handle, point } of handles) {
    if (distance(pointer, point) <= radius) return handle;
  }

  return null;
};

import { ShapeBounds, Stroke, StrokePoint, Tool, TransformHandle, TransformSession } from "@/types";
import { constrainLineToAxis } from "@/components/Canvas/utils/constrainLineToAxis";
import {
  getBoundsCenter,
  getStrokeEndpoints,
  getStrokeRotation,
  inverseRotatePoint,
  rotatePoint,
  withStrokeEndpoints,
} from "./core";

const MIN_SIZE = 8;
const SNAP_ANGLE_STEP_DEG = 15;
const SNAP_ANGLE_STEP_RAD = (SNAP_ANGLE_STEP_DEG * Math.PI) / 180;

const snapAngle = (angle: number) =>
  Math.round(angle / SNAP_ANGLE_STEP_RAD) * SNAP_ANGLE_STEP_RAD;

const isCornerHandle = (handle: TransformHandle) =>
  handle === "nw" || handle === "ne" || handle === "sw" || handle === "se";

const includesWest = (handle: TransformHandle) =>
  handle === "w" || handle === "nw" || handle === "sw";

const includesEast = (handle: TransformHandle) =>
  handle === "e" || handle === "ne" || handle === "se";

const includesNorth = (handle: TransformHandle) =>
  handle === "n" || handle === "nw" || handle === "ne";

const includesSouth = (handle: TransformHandle) =>
  handle === "s" || handle === "sw" || handle === "se";

const getOppositeCorner = (
  handle: TransformHandle,
  left: number,
  top: number,
  right: number,
  bottom: number
) => {
  switch (handle) {
    case "nw":
      return { x: right, y: bottom };
    case "ne":
      return { x: left, y: bottom };
    case "sw":
      return { x: right, y: top };
    case "se":
    default:
      return { x: left, y: top };
  }
};

const rotateLineStroke = (stroke: Stroke, angle: number): Stroke => {
  const [start, end] = getStrokeEndpoints(stroke);
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  const rotatedStart = rotatePoint(start, center, angle);
  const rotatedEnd = rotatePoint(end, center, angle);

  return {
    ...withStrokeEndpoints(stroke, rotatedStart, rotatedEnd),
    rotation: 0,
  };
};

const moveStroke = (stroke: Stroke, dx: number, dy: number): Stroke => {
  const [start, end] = getStrokeEndpoints(stroke);
  return withStrokeEndpoints(
    stroke,
    { ...start, x: start.x + dx, y: start.y + dy },
    { ...end, x: end.x + dx, y: end.y + dy }
  );
};

const resizeLineStroke = (
  stroke: Stroke,
  handle: TransformHandle,
  pointer: StrokePoint,
  keepAxis: boolean
): Stroke => {
  const [start, end] = getStrokeEndpoints(stroke);

  if (handle === "nw") {
    const nextStart = keepAxis ? constrainLineToAxis(end, pointer, 15) : pointer;
    return withStrokeEndpoints(stroke, nextStart, end);
  }

  if (handle === "se") {
    const nextEnd = keepAxis ? constrainLineToAxis(start, pointer, 15) : pointer;
    return withStrokeEndpoints(stroke, start, nextEnd);
  }

  return stroke;
};

const resizeShapeBounds = (
  session: TransformSession,
  pointer: StrokePoint,
  keepAspect: boolean
): { bounds: ShapeBounds; rotation: number } => {
  const { handle, initialBounds, initialRotation } = session;
  const center = getBoundsCenter(initialBounds);

  let left = -initialBounds.width / 2;
  let right = initialBounds.width / 2;
  let top = -initialBounds.height / 2;
  let bottom = initialBounds.height / 2;

  const localPointer = inverseRotatePoint(pointer, center, initialRotation);

  if (includesWest(handle)) left = localPointer.x - center.x;
  if (includesEast(handle)) right = localPointer.x - center.x;
  if (includesNorth(handle)) top = localPointer.y - center.y;
  if (includesSouth(handle)) bottom = localPointer.y - center.y;

  if (keepAspect && isCornerHandle(handle) && initialBounds.width > 0 && initialBounds.height > 0) {
    const anchor = getOppositeCorner(handle, left, top, right, bottom);
    const moving = {
      x: includesWest(handle) ? left : right,
      y: includesNorth(handle) ? top : bottom,
    };

    const ratio = initialBounds.width / initialBounds.height;
    const dx = moving.x - anchor.x;
    const dy = moving.y - anchor.y;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy) || 0.0001;

    let nextWidth = absDx;
    let nextHeight = absDy;

    if (nextWidth / nextHeight > ratio) {
      nextWidth = nextHeight * ratio;
    } else {
      nextHeight = nextWidth / ratio;
    }

    const nextX = anchor.x + Math.sign(dx || 1) * nextWidth;
    const nextY = anchor.y + Math.sign(dy || 1) * nextHeight;

    if (includesWest(handle)) left = nextX;
    if (includesEast(handle)) right = nextX;
    if (includesNorth(handle)) top = nextY;
    if (includesSouth(handle)) bottom = nextY;
  }

  if (right - left < MIN_SIZE) {
    if (includesWest(handle)) {
      left = right - MIN_SIZE;
    } else {
      right = left + MIN_SIZE;
    }
  }

  if (bottom - top < MIN_SIZE) {
    if (includesNorth(handle)) {
      top = bottom - MIN_SIZE;
    } else {
      bottom = top + MIN_SIZE;
    }
  }

  const localCenter = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };

  const worldCenter = rotatePoint(
    {
      x: center.x + localCenter.x,
      y: center.y + localCenter.y,
    },
    center,
    initialRotation
  );

  const width = right - left;
  const height = bottom - top;

  return {
    bounds: {
      x: worldCenter.x - width / 2,
      y: worldCenter.y - height / 2,
      width,
      height,
    },
    rotation: initialRotation,
  };
};

export const applySessionTransform = (
  session: TransformSession,
  pointer: StrokePoint,
  shiftKey: boolean
): Stroke => {
  const { initialStroke, handle, startPointer, initialBounds, initialRotation } = session;

  if (handle === "move") {
    const dx = pointer.x - startPointer.x;
    const dy = pointer.y - startPointer.y;
    return moveStroke(initialStroke, dx, dy);
  }

  if (handle === "rotate") {
    if (initialStroke.tool === Tool.Line || initialStroke.tool === Tool.Arrow) {
      const [start, end] = getStrokeEndpoints(initialStroke);
      const center = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      const from = Math.atan2(startPointer.y - center.y, startPointer.x - center.x);
      const to = Math.atan2(pointer.y - center.y, pointer.x - center.x);
      const initialLineAngle = Math.atan2(end.y - start.y, end.x - start.x);
      const nextLineAngle = initialLineAngle + (to - from);
      const normalizedLineAngle = shiftKey ? snapAngle(nextLineAngle) : nextLineAngle;
      const rotationDelta = normalizedLineAngle - initialLineAngle;

      return rotateLineStroke(initialStroke, rotationDelta);
    }

    const center = getBoundsCenter(initialBounds);
    const startAngle =
      session.startPointerAngle ??
      Math.atan2(startPointer.y - center.y, startPointer.x - center.x);
    const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    const nextRotation = initialRotation + (currentAngle - startAngle);
    const normalizedRotation = shiftKey ? snapAngle(nextRotation) : nextRotation;

    return {
      ...initialStroke,
      rotation: normalizedRotation,
    };
  }

  if (
    (initialStroke.tool === Tool.Line || initialStroke.tool === Tool.Arrow) &&
    (handle === "nw" || handle === "se")
  ) {
    return resizeLineStroke(initialStroke, handle, pointer, shiftKey);
  }

  const { bounds, rotation } = resizeShapeBounds(
    session,
    pointer,
    shiftKey && isCornerHandle(handle)
  );

  const start: StrokePoint = {
    x: bounds.x,
    y: bounds.y,
    pressure: initialStroke.points[0]?.pressure ?? 0.5,
  };
  const end: StrokePoint = {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
    pressure:
      initialStroke.points[initialStroke.points.length - 1]?.pressure ?? 0.5,
  };

  return {
    ...withStrokeEndpoints(initialStroke, start, end),
    rotation,
  };
};

export const replaceStrokeById = (strokes: Stroke[], nextStroke: Stroke) =>
  strokes.map((stroke) => (stroke.id === nextStroke.id ? { ...nextStroke } : stroke));

export const buildPreviewStrokes = (
  strokes: Stroke[],
  session: TransformSession | null
): Stroke[] => {
  if (!session) return strokes;
  return replaceStrokeById(strokes, session.draftStroke);
};

export const hasStrokeTransformChanged = (
  initialStroke: Stroke,
  nextStroke: Stroke
) => {
  const [initialStart, initialEnd] = getStrokeEndpoints(initialStroke);
  const [nextStart, nextEnd] = getStrokeEndpoints(nextStroke);

  return (
    initialStart.x !== nextStart.x ||
    initialStart.y !== nextStart.y ||
    initialEnd.x !== nextEnd.x ||
    initialEnd.y !== nextEnd.y ||
    getStrokeRotation(initialStroke) !== getStrokeRotation(nextStroke)
  );
};

import {
  GroupMoveSession,
  ShapeBounds,
  ShapeEditorSession,
  Stroke,
  StrokePoint,
  Tool,
  TransformHandle,
  TransformSession,
} from "@/types";
import { constrainLineToAxis } from "@/components/Canvas/utils/constrainLineToAxis";
import { normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";
import {
  getBoundsCenter,
  getStrokeEndpoints,
  getStrokeRotation,
  inverseRotatePoint,
  rotatePoint,
  withStrokeEndpoints,
} from "./core";

const MIN_SIZE = 8;
const MIN_TEXT_FONT_SIZE = 8;
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

const getCornerAxisDirection = (handle: TransformHandle) => ({
  x: includesWest(handle) ? -1 : 1,
  y: includesNorth(handle) ? -1 : 1,
});

const clampCornerBoundsToMinSize = (
  bounds: ShapeBounds,
  handle: TransformHandle,
  minWidth: number,
  minHeight: number
): ShapeBounds => {
  if (!isCornerHandle(handle)) return bounds;

  const width = Math.max(bounds.width, minWidth);
  const height = Math.max(bounds.height, minHeight);

  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  if (handle === "nw") {
    return { x: right - width, y: bottom - height, width, height };
  }

  if (handle === "ne") {
    return { x: bounds.x, y: bottom - height, width, height };
  }

  if (handle === "sw") {
    return { x: right - width, y: bounds.y, width, height };
  }

  return { x: bounds.x, y: bounds.y, width, height };
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
  return {
    ...stroke,
    points: stroke.points.map((point) => ({
      ...point,
      x: point.x + dx,
      y: point.y + dy,
    })),
  };
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
    const axisDirection = getCornerAxisDirection(handle);

    const ratio = initialBounds.width / initialBounds.height;
    const projectedDx = (moving.x - anchor.x) * axisDirection.x;
    const projectedDy = (moving.y - anchor.y) * axisDirection.y;
    const safeDx = Math.max(projectedDx, MIN_SIZE);
    const safeDy = Math.max(projectedDy, MIN_SIZE);

    let nextWidth = safeDx;
    let nextHeight = safeDy;

    if (nextWidth / nextHeight > ratio) {
      nextWidth = nextHeight * ratio;
    } else {
      nextHeight = nextWidth / ratio;
    }

    const nextX = anchor.x + axisDirection.x * nextWidth;
    const nextY = anchor.y + axisDirection.y * nextHeight;

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
    if (
      initialStroke.tool === Tool.Line ||
      initialStroke.tool === Tool.Arrow ||
      initialStroke.tool === Tool.Highlighter
    ) {
      const [start, end] = getStrokeEndpoints(initialStroke);
      const center = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      const from = Math.atan2(startPointer.y - center.y, startPointer.x - center.x);
      const to = Math.atan2(pointer.y - center.y, pointer.x - center.x);
      const initialLineAngle = Math.atan2(end.y - start.y, end.x - start.x);
      const nextLineAngle = initialLineAngle + (to - from);
      const shouldSnapAngle =
        initialStroke.tool === Tool.Highlighter ? !shiftKey : shiftKey;
      const normalizedLineAngle = shouldSnapAngle
        ? snapAngle(nextLineAngle)
        : nextLineAngle;
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
    (initialStroke.tool === Tool.Line ||
      initialStroke.tool === Tool.Arrow ||
      initialStroke.tool === Tool.Highlighter) &&
    (handle === "nw" || handle === "se")
  ) {
    const keepAxis =
      initialStroke.tool === Tool.Highlighter ? !shiftKey : shiftKey;
    return resizeLineStroke(initialStroke, handle, pointer, keepAxis);
  }

  const keepAspect =
    isCornerHandle(handle) &&
    (shiftKey || initialStroke.tool === Tool.Text);

  const { bounds, rotation } = resizeShapeBounds(session, pointer, keepAspect);

  if (initialStroke.tool === Tool.Text && initialStroke.text) {
    const normalized = normalizeTextStroke(initialStroke);
    const sourceBounds = initialBounds;
    const baseFontSize = Math.max(1, normalized.text?.fontSize ?? MIN_TEXT_FONT_SIZE);
    const minScale = MIN_TEXT_FONT_SIZE / baseFontSize;
    const minWidth = Math.max(1, sourceBounds.width * minScale);
    const minHeight = Math.max(1, sourceBounds.height * minScale);
    const clampedBounds = clampCornerBoundsToMinSize(
      bounds,
      handle,
      minWidth,
      minHeight
    );

    const widthScale =
      sourceBounds.width > 0 ? clampedBounds.width / sourceBounds.width : 1;
    const heightScale =
      sourceBounds.height > 0 ? clampedBounds.height / sourceBounds.height : 1;
    const scale = Math.max(0.01, (widthScale + heightScale) / 2);
    const nextFontSize = Math.max(
      MIN_TEXT_FONT_SIZE,
      Math.round(normalized.text!.fontSize * scale)
    );

    const start: StrokePoint = {
      x: clampedBounds.x,
      y: clampedBounds.y,
      pressure: normalized.points[0]?.pressure ?? 0.5,
    };
    const end: StrokePoint = {
      x: clampedBounds.x + clampedBounds.width,
      y: clampedBounds.y + clampedBounds.height,
      pressure: normalized.points[1]?.pressure ?? 0.5,
    };

    return {
      ...withStrokeEndpoints(normalized, start, end),
      rotation,
      text: {
        ...normalized.text!,
        fontSize: nextFontSize,
        width: Math.max(1, clampedBounds.width),
        height: Math.max(1, clampedBounds.height),
      },
      thickness: nextFontSize,
    };
  }

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

export const moveStrokeIdsToEnd = (strokes: Stroke[], ids: string[]) => {
  if (ids.length === 0) return strokes;
  const uniqueIds = Array.from(new Set(ids));
  const idSet = new Set(uniqueIds);

  const kept = strokes.filter((stroke) => !idSet.has(stroke.id));
  const moved = uniqueIds
    .map((id) => strokes.find((stroke) => stroke.id === id))
    .filter((stroke): stroke is Stroke => Boolean(stroke))
    .map((stroke) => ({ ...stroke }));

  return [...kept, ...moved];
};

export const buildPreviewStrokes = (
  strokes: Stroke[],
  session: ShapeEditorSession | null
): Stroke[] => {
  if (!session) return strokes;
  if (session.type === "single") {
    return replaceStrokeById(strokes, session.draftStroke);
  }

  return strokes.map((stroke) => {
    const draftStroke = session.draftStrokesById[stroke.id];
    return draftStroke ? { ...draftStroke } : stroke;
  });
};

export const hasGroupMoveChanged = (session: GroupMoveSession) =>
  session.strokeIds.some((id) => {
    const initialStroke = session.initialStrokesById[id];
    const nextStroke = session.draftStrokesById[id];
    if (!initialStroke || !nextStroke) return false;
    return hasStrokeTransformChanged(initialStroke, nextStroke);
  });

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

import { ShapeBounds, Stroke, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeTransformHandles,
  getStrokeRotation,
  rotatePoint,
} from "@/store/useShapeEditorStore/helpers";

const SELECTION_OUTLINE_COLOR = "#0f62fe";
const SELECTION_OUTLINE_COLOR_HOVER = "#0353e9";
const SELECTION_FILL_COLOR = "rgba(15, 98, 254, 0.08)";
const SELECTION_FILL_COLOR_GROUP = "rgba(15, 98, 254, 0.06)";
const SELECTION_OUTLINE_WIDTH = 1;
const SELECTION_OUTLINE_WIDTH_HOVER = 1.75;
const MIN_FILL_SIZE = 4;
const HANDLE_FILL = "#ffffff";
const HANDLE_STROKE = SELECTION_OUTLINE_COLOR;

interface OverlayOptions {
  isHoverActive?: boolean;
}

export const drawShapeEditorOverlay = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  options?: OverlayOptions
) => {
  const [start, end] = getStrokeEndpoints(stroke);
  const outlineColor = options?.isHoverActive
    ? SELECTION_OUTLINE_COLOR_HOVER
    : SELECTION_OUTLINE_COLOR;
  const outlineWidth = options?.isHoverActive
    ? SELECTION_OUTLINE_WIDTH_HOVER
    : SELECTION_OUTLINE_WIDTH;

  ctx.save();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.setLineDash([4, 4]);

  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) {
    const points = stroke.points;

    if (points.length > 0) {
      let minX = points[0].x;
      let maxX = points[0].x;
      let minY = points[0].y;
      let maxY = points[0].y;

      points.forEach((point) => {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      });

      const padding = Math.max(6, stroke.thickness * 2);
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;
      if (width >= MIN_FILL_SIZE && height >= MIN_FILL_SIZE) {
        ctx.fillStyle = SELECTION_FILL_COLOR;
        ctx.fillRect(minX - padding, minY - padding, width, height);
      }
      ctx.strokeRect(
        minX - padding,
        minY - padding,
        width,
        height
      );
    }
  } else if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = SELECTION_FILL_COLOR;
    ctx.lineWidth = Math.max(stroke.thickness + 10, 12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else {
    const bounds = getStrokeBounds(stroke);
    const center = getBoundsCenter(bounds);
    const rotation = getStrokeRotation(stroke);

    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ].map((point) => rotatePoint(point, center, rotation));

    if (bounds.width >= MIN_FILL_SIZE && bounds.height >= MIN_FILL_SIZE) {
      ctx.fillStyle = SELECTION_FILL_COLOR;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i += 1) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i += 1) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.setLineDash([]);

  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) {
    ctx.restore();
    return;
  }

  const handles = getStrokeTransformHandles(stroke);
  handles.forEach(({ point, handle }) => {
    ctx.beginPath();
    if (handle === "rotate") {
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = outlineColor;
      ctx.fill();
      return;
    }

    ctx.fillStyle = HANDLE_FILL;
    ctx.strokeStyle = HANDLE_STROKE;
    ctx.rect(point.x - 4, point.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
};

const getUnionBounds = (strokes: Stroke[]): ShapeBounds | null => {
  if (strokes.length === 0) return null;

  const first = getStrokeAABB(strokes[0]);
  let minX = first.x;
  let maxX = first.x + first.width;
  let minY = first.y;
  let maxY = first.y + first.height;

  for (let index = 1; index < strokes.length; index += 1) {
    const stroke = strokes[index];
    if (!stroke) continue;
    const bounds = getStrokeAABB(stroke);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const drawGroupSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  options?: OverlayOptions
) => {
  const bounds = getUnionBounds(strokes);
  if (!bounds) return;

  const outlineColor = options?.isHoverActive
    ? SELECTION_OUTLINE_COLOR_HOVER
    : SELECTION_OUTLINE_COLOR;
  const outlineWidth = options?.isHoverActive
    ? SELECTION_OUTLINE_WIDTH_HOVER
    : SELECTION_OUTLINE_WIDTH;

  ctx.save();
  if (bounds.width >= MIN_FILL_SIZE && bounds.height >= MIN_FILL_SIZE) {
    ctx.fillStyle = SELECTION_FILL_COLOR_GROUP;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.restore();
};

export const drawMarqueeOverlay = (
  ctx: CanvasRenderingContext2D,
  bounds: ShapeBounds
) => {
  ctx.save();
  ctx.strokeStyle = SELECTION_OUTLINE_COLOR;
  ctx.fillStyle = "rgba(15, 98, 254, 0.1)";
  ctx.lineWidth = SELECTION_OUTLINE_WIDTH;
  ctx.setLineDash([4, 4]);
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.restore();
};

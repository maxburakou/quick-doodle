import { ShapeBounds, Stroke, StrokePoint, Tool } from "@/types";
import { ACTIVE_ZONE_PX } from "@/config/selectionConfig";
import { getHighlighterStrokeWidth } from "@/utils/highlighter";
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

interface OverlayStyle {
  outlineColor: string;
  outlineWidth: number;
}

const getOverlayStyle = (options?: OverlayOptions): OverlayStyle => ({
  outlineColor: options?.isHoverActive
    ? SELECTION_OUTLINE_COLOR_HOVER
    : SELECTION_OUTLINE_COLOR,
  outlineWidth: options?.isHoverActive
    ? SELECTION_OUTLINE_WIDTH_HOVER
    : SELECTION_OUTLINE_WIDTH,
});

const drawPolyline = (ctx: CanvasRenderingContext2D, points: StrokePoint[]) => {
  if (points.length === 0) return;
  const firstPoint = points[0];
  if (!firstPoint) return;

  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    ctx.lineTo(point.x, point.y);
  }
};

const drawLineLikeSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  activeZoneWidth: number,
  outlineColor: string
) => {
  if (points.length === 0) return;
  const pathPoints = points.length >= 2 ? points : [points[0], points[0]];

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = SELECTION_FILL_COLOR;
  ctx.lineWidth = activeZoneWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawPolyline(ctx, pathPoints);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = outlineColor;
  drawPolyline(ctx, pathPoints);
  ctx.stroke();
};

const getDefaultLineLikeOverlayWidth = (thickness: number) =>
  Math.max(thickness + 10, 12);

const getHighlighterOverlayWidth = (thickness: number) =>
  Math.max(
    getDefaultLineLikeOverlayWidth(thickness),
    getHighlighterStrokeWidth(thickness) + ACTIVE_ZONE_PX * 2
  );

const drawPolygonFromCorners = (
  ctx: CanvasRenderingContext2D,
  corners: StrokePoint[]
) => {
  if (corners.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
};

const drawShapeBoundsOverlay = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
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
    drawPolygonFromCorners(ctx, corners);
    ctx.fill();
  }

  drawPolygonFromCorners(ctx, corners);
  ctx.stroke();
};

const drawTransformHandles = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  outlineColor: string
) => {
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
};

export const drawShapeEditorOverlay = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  options?: OverlayOptions
) => {
  const { outlineColor, outlineWidth } = getOverlayStyle(options);
  const [start, end] = getStrokeEndpoints(stroke);

  ctx.save();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.setLineDash([4, 4]);

  switch (stroke.tool) {
    case Tool.Pen: {
      const penPoints = stroke.points.length >= 2 ? stroke.points : [start, end];
      drawLineLikeSelectionOverlay(
        ctx,
        penPoints,
        getDefaultLineLikeOverlayWidth(stroke.thickness),
        outlineColor
      );
      break;
    }
    case Tool.Line:
    case Tool.Arrow:
      drawLineLikeSelectionOverlay(
        ctx,
        [start, end],
        getDefaultLineLikeOverlayWidth(stroke.thickness),
        outlineColor
      );
      break;
    case Tool.Highlighter:
      drawLineLikeSelectionOverlay(
        ctx,
        [start, end],
        getHighlighterOverlayWidth(stroke.thickness),
        outlineColor
      );
      break;
    default:
      drawShapeBoundsOverlay(ctx, stroke);
      break;
  }

  ctx.setLineDash([]);

  if (stroke.tool === Tool.Pen) {
    ctx.restore();
    return;
  }

  drawTransformHandles(ctx, stroke, outlineColor);

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
  const { outlineColor, outlineWidth } = getOverlayStyle(options);

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

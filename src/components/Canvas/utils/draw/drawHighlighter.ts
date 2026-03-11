import { StrokePoint } from "@/types";
import { constrainLineToAxis } from "../constrainLineToAxis";
import { HIGHLIGHTER_STROKE_WIDTH_MULTIPLIER } from "@/config";

export const getHighlighterStrokeWidth = (thickness: number) =>
  Math.max(1, thickness * HIGHLIGHTER_STROKE_WIDTH_MULTIPLIER);

export const getHighlighterHitRadius = (thickness: number) =>
  getHighlighterStrokeWidth(thickness) / 2;

export const drawHighlighter = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  isShiftPressed?: boolean
) => {
  const adjustedEnd = isShiftPressed
    ? constrainLineToAxis(start, end, 15)
    : end;

  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = getHighlighterStrokeWidth(thickness);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(adjustedEnd.x, adjustedEnd.y);
  ctx.stroke();

  ctx.globalAlpha = 1;
};

import { StrokePoint } from "@/types";
import { constrainLineToAxis } from "../constrainLineToAxis";

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
  ctx.lineWidth = thickness * 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(adjustedEnd.x, adjustedEnd.y);
  ctx.stroke();

  ctx.globalAlpha = 1;
};

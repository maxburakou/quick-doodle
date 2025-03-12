import { StrokePoint } from "../../../../types";

export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number
) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowHeadLength = 15 + thickness * 2.5;

  const lineEnd = {
    x: end.x - arrowHeadLength * 0.3 * Math.cos(angle),
    y: end.y - arrowHeadLength * 0.3 * Math.sin(angle),
  };

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(lineEnd.x, lineEnd.y);
  ctx.stroke();

  const arrowHead1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 12),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 12),
  };

  const arrowHead2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 12),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 12),
  };

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(arrowHead1.x, arrowHead1.y);
  ctx.lineTo(arrowHead2.x, arrowHead2.y);
  ctx.closePath();
  ctx.fill();
};

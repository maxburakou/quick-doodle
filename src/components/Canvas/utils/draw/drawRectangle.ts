import { StrokePoint } from "../../../../types";

export const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  ctx.stroke();
};

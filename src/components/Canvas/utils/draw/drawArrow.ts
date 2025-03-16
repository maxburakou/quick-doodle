import rough from "roughjs";
import { RoughShape, StrokePoint } from "../../../../types";
import { Drawable, Options } from "roughjs/bin/core";
import { generateRoughShape } from "../generateRoughShape";

export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  drawable?: Drawable
) => {
  const roughCanvas = rough.canvas(ctx.canvas);

  const options: Options = {
    stroke: color,
    strokeWidth: thickness / 1.5,
    roughness: 1,
    bowing: 0.5,
  };

  const arrowHeadLength = 15 + thickness * 2.5;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  const line =
    drawable || generateRoughShape(RoughShape.Line, start, end, options);

  if (line) roughCanvas.draw(line);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;

  const arrowTip = {
    x: end.x + arrowHeadLength * 0.3 * Math.cos(angle),
    y: end.y + arrowHeadLength * 0.3 * Math.sin(angle),
  };

  const arrowHead1 = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 12),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 12),
  };

  const arrowHead2 = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 12),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 12),
  };

  ctx.beginPath();
  ctx.moveTo(arrowTip.x, arrowTip.y);
  ctx.lineTo(arrowHead1.x, arrowHead1.y);
  ctx.lineTo(arrowHead2.x, arrowHead2.y);
  ctx.closePath();
  ctx.fill();
};

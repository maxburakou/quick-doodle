import rough from "roughjs";
import { RoughShape, StrokePoint } from "../../../../types";
import { Options } from "roughjs/bin/core";
import { generateRoughShape } from "../generateRoughShape";

export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  drawableSeed?: number
) => {
  const roughCanvas = rough.canvas(ctx.canvas);

  const options: Options = {
    stroke: color,
    strokeWidth: thickness / 1.5,
    roughness: 1,
    bowing: 0.5,
    seed: drawableSeed,
  };

  const arrowHeadLength = 15 + thickness * 2.5;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  const line = generateRoughShape(RoughShape.Line, start, end, options);
  if (line) roughCanvas.draw(line);

  const arrowHead1: StrokePoint = {
    x: end.x - arrowHeadLength * Math.cos(angle - Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle - Math.PI / 6),
    pressure: end.pressure,
  };

  const arrowHead2: StrokePoint = {
    x: end.x - arrowHeadLength * Math.cos(angle + Math.PI / 6),
    y: end.y - arrowHeadLength * Math.sin(angle + Math.PI / 6),
    pressure: end.pressure,
  };

  const roughArrowHead1 = generateRoughShape(
    RoughShape.Line,
    end,
    arrowHead1,
    options
  );
  const roughArrowHead2 = generateRoughShape(
    RoughShape.Line,
    end,
    arrowHead2,
    options
  );

  if (roughArrowHead1) roughCanvas.draw(roughArrowHead1);
  if (roughArrowHead2) roughCanvas.draw(roughArrowHead2);
};

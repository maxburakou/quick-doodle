import { Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint } from "../../../../types";
import rough from "roughjs";
import { generateRoughShape } from "../generateRoughShape";
import { getRoughOptions } from "../getRoughOptions";

export const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  drawableSeed?: number
) => {
  const roughCanvas = rough.canvas(ctx.canvas);

  const options: Options = getRoughOptions({
    stroke: color,
    strokeWidth: thickness / 1.5,
    seed: drawableSeed,
  });

  const ellipse = generateRoughShape(RoughShape.Ellipse, start, end, options);

  if (ellipse) roughCanvas.draw(ellipse);
};

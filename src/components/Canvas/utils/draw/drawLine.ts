import { Drawable, Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint } from "../../../../types";
import rough from "roughjs";
import { generateRoughShape } from "../generateRoughShape";

export const drawLine = (
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

  const line =
    drawable || generateRoughShape(RoughShape.Line, start, end, options);

  if (line) roughCanvas.draw(line);
};

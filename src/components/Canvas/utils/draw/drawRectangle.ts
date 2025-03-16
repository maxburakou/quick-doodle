import { Drawable, Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint } from "../../../../types";
import { generateRoughShape } from "../generateRoughShape";
import rough from "roughjs";

export const drawRectangle = (
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

  const rectangle =
    drawable || generateRoughShape(RoughShape.Rectangle, start, end, options);

  if (rectangle) roughCanvas.draw(rectangle);
};

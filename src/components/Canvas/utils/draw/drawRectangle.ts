import { Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint } from "@/types";
import { generateRoughShape } from "../generateRoughShape";
import rough from "roughjs";
import { getRoughOptions } from "../getRoughOptions";

export const drawRectangle = (
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

  const rectangle = generateRoughShape(
    RoughShape.Rectangle,
    start,
    end,
    options
  );

  if (rectangle) roughCanvas.draw(rectangle);
};

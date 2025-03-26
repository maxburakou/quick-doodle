import { Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint } from "@/types";
import { generateRoughShape } from "../generateRoughShape";
import rough from "roughjs";
import { getRoughOptions } from "../getRoughOptions";
import { constrainToSquareBounds } from "../constrainToSquareBounds";

export const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  drawableSeed?: number,
  isShiftPressed?: boolean
) => {
  const roughCanvas = rough.canvas(ctx.canvas);

  const adjustedEnd = isShiftPressed
    ? constrainToSquareBounds(start, end)
    : end;

  const options: Options = getRoughOptions({
    stroke: color,
    strokeWidth: thickness / 1.5,
    seed: drawableSeed,
  });

  const rectangle = generateRoughShape(
    RoughShape.Rectangle,
    start,
    adjustedEnd,
    options
  );

  if (rectangle) roughCanvas.draw(rectangle);
};

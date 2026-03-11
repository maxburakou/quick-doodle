import rough from "roughjs";
import { Options } from "roughjs/bin/core";
import { RoughShape, ShapeFill, StrokePoint } from "@/types";
import { generateRoughShape } from "../generateRoughShape";
import { getRoughOptions } from "../getRoughOptions";
import { constrainToSquareBounds } from "../constrainToSquareBounds";
import { getShapeFillOptions } from "./getShapeFillOptions";

export const drawBoxLikeShape = (
  ctx: CanvasRenderingContext2D,
  shape: RoughShape,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  shapeFill?: ShapeFill,
  drawableSeed?: number,
  isShiftPressed?: boolean,
  rotation: number = 0
) => {
  const roughCanvas = rough.canvas(ctx.canvas);

  const adjustedEnd = isShiftPressed
    ? constrainToSquareBounds(start, end)
    : end;

  const options: Options = getRoughOptions({
    stroke: color,
    strokeWidth: thickness / 1.5,
    ...getShapeFillOptions(Boolean(shapeFill)),
    seed: drawableSeed,
  });

  const drawable = generateRoughShape(shape, start, adjustedEnd, options);

  if (drawable) {
    const centerX = (start.x + adjustedEnd.x) / 2;
    const centerY = (start.y + adjustedEnd.y) / 2;

    ctx.save();
    if (rotation !== 0) {
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
    }
    roughCanvas.draw(drawable);
    ctx.restore();
  }
};

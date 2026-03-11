import { RoughShape, ShapeFill, StrokePoint } from "@/types";
import { drawBoxLikeShape } from "./drawBoxLikeShape";

export const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  start: StrokePoint,
  end: StrokePoint,
  color: string,
  thickness: number,
  shapeFill?: ShapeFill,
  drawableSeed?: number,
  isShiftPressed?: boolean,
  rotation: number = 0
) => {
  drawBoxLikeShape(
    ctx, RoughShape.Ellipse, start, end,
    color, thickness, shapeFill, drawableSeed, isShiftPressed, rotation
  );
};

import rough from "roughjs";
import { RoughShape, StrokePoint } from "@/types";
import { Options } from "roughjs/bin/core";
import { generateRoughShape } from "../generateRoughShape";
import { getRoughOptions } from "../getRoughOptions";
import { constrainLineToAxis } from "../constrainLineToAxis";

export const drawArrow = (
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
    ? constrainLineToAxis(start, end, 15)
    : end;

  const dx = adjustedEnd.x - start.x;
  const dy = adjustedEnd.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const options: Options = getRoughOptions({
    stroke: color,
    strokeWidth: thickness / 1.5,
    seed: drawableSeed,
  });

  const angle = Math.atan2(dy, dx);

  const baseArrowHeadLength = 15 + thickness * 2.5;

  const minArrowLength = 15;

  const arrowHeadLength =
    length >= minArrowLength
      ? Math.min(baseArrowHeadLength, length / 2)
      : 0;

  const line = generateRoughShape(RoughShape.Line, start, adjustedEnd, options);
  if (line) roughCanvas.draw(line);

  if (arrowHeadLength) {
    const arrowHead1: StrokePoint = {
      x: adjustedEnd.x - arrowHeadLength * Math.cos(angle - Math.PI / 10),
      y: adjustedEnd.y - arrowHeadLength * Math.sin(angle - Math.PI / 10),
      pressure: adjustedEnd.pressure,
    };

    const arrowHead2: StrokePoint = {
      x: adjustedEnd.x - arrowHeadLength * Math.cos(angle + Math.PI / 10),
      y: adjustedEnd.y - arrowHeadLength * Math.sin(angle + Math.PI / 10),
      pressure: adjustedEnd.pressure,
    };

    const roughArrowHead1 = generateRoughShape(
      RoughShape.Line,
      adjustedEnd,
      arrowHead1,
      options
    );
    const roughArrowHead2 = generateRoughShape(
      RoughShape.Line,
      adjustedEnd,
      arrowHead2,
      options
    );

    if (roughArrowHead1) roughCanvas.draw(roughArrowHead1);
    if (roughArrowHead2) roughCanvas.draw(roughArrowHead2);
  }
};

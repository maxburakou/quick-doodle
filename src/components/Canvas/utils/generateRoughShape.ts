import rough from "roughjs";
import { RoughShape, StrokePoint, Stroke, Tool } from "@/types";
import { Options } from "roughjs/bin/core";
import { getRoughOptions } from "./getRoughOptions";
import { getShapeFillOptions } from "./draw/getShapeFillOptions";
import { constrainToSquareBounds } from "./constrainToSquareBounds";
import { constrainLineToAxis } from "./constrainLineToAxis";

const generator = rough.generator();

export const generateRoughShape = (
  shape: RoughShape,
  start: StrokePoint,
  end: StrokePoint,
  options?: Options
) => {
  switch (shape) {
    case RoughShape.Line:
      return generator.line(start.x, start.y, end.x, end.y, options);
    case RoughShape.Rectangle:
      return generator.rectangle(
        start.x,
        start.y,
        end.x - start.x,
        end.y - start.y,
        options
      );
    case RoughShape.Ellipse:
      return generator.ellipse(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        end.x - start.x,
        end.y - start.y,
        options
      );
    case RoughShape.Diamond: {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;

      return generator.polygon(
        [
          [centerX, start.y],
          [end.x, centerY],
          [centerX, end.y],
          [start.x, centerY],
        ],
        options
      );
    }
    case RoughShape.Polygon:
      return generator.polygon(
        [
          [start.x, start.y],
          [end.x, start.y],
          [end.x, end.y],
          [start.x, end.y],
        ],
        options
      );
    default:
      return;
  }
};

export const getStrokeDrawables = (stroke: Stroke) => {
  const start = stroke.points[0];
  const rawEnd = stroke.points[stroke.points.length - 1] ?? start;

  let end = rawEnd;
  if (stroke.isShiftPressed) {
    if (stroke.tool === Tool.Line) end = constrainLineToAxis(start, rawEnd);
    else if (stroke.tool !== Tool.Arrow) end = constrainToSquareBounds(start, rawEnd);
  }

  const options = getRoughOptions({
    stroke: stroke.color,
    strokeWidth: stroke.thickness / 1.5,
    ...getShapeFillOptions(Boolean(stroke.shapeFill)),
    seed: stroke.drawableSeed,
  });

  if (stroke.tool === Tool.Arrow) {
    const adjustedEnd = stroke.isShiftPressed
      ? constrainLineToAxis(start, rawEnd, 15)
      : rawEnd;

    const dx = adjustedEnd.x - start.x;
    const dy = adjustedEnd.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const baseArrowHeadLength = 15 + stroke.thickness * 2.5;
    const arrowHeadLength =
      length >= 15 ? Math.min(baseArrowHeadLength, length / 2) : 0;

    const line = generateRoughShape(RoughShape.Line, start, adjustedEnd, options);
    const drawables = line ? [line] : [];

    if (arrowHeadLength) {
      const p1: StrokePoint = {
        x: adjustedEnd.x - arrowHeadLength * Math.cos(angle - Math.PI / 10),
        y: adjustedEnd.y - arrowHeadLength * Math.sin(angle - Math.PI / 10),
        pressure: adjustedEnd.pressure,
      };
      const p2: StrokePoint = {
        x: adjustedEnd.x - arrowHeadLength * Math.cos(angle + Math.PI / 10),
        y: adjustedEnd.y - arrowHeadLength * Math.sin(angle + Math.PI / 10),
        pressure: adjustedEnd.pressure,
      };
      const h1 = generateRoughShape(RoughShape.Line, adjustedEnd, p1, options);
      const h2 = generateRoughShape(RoughShape.Line, adjustedEnd, p2, options);
      if (h1) drawables.push(h1);
      if (h2) drawables.push(h2);
    }
    return drawables;
  }

  const drawable = generateRoughShape(stroke.tool as unknown as RoughShape, start, end, options);
  return drawable ? [drawable] : [];
};

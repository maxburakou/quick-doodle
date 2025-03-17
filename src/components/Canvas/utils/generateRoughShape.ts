import rough from "roughjs";
import { RoughShape, StrokePoint } from "../../../types";
import { Options } from "roughjs/bin/core";

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

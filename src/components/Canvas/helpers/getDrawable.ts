import { Options } from "roughjs/bin/core";
import { RoughShape, StrokePoint, Tool } from "../../../types";
import { generateRoughShape } from "../utils/generateRoughShape";

const toolToShapeMap: { [key in Tool]?: RoughShape } = {
  [Tool.Line]: RoughShape.Line,
  [Tool.Rectangle]: RoughShape.Rectangle,
  [Tool.Ellipse]: RoughShape.Ellipse,
  [Tool.Arrow]: RoughShape.Line,
};

export const getDrawable = (
  tool: Tool,
  start: StrokePoint,
  end: StrokePoint,
  options?: Options
) => {
  const shape = toolToShapeMap[tool];
  if (!shape) {
    return;
  }
  return generateRoughShape(shape, start, end, options);
};

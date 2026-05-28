import { StrokePoint } from "@/types";
import simplify from "simplify-js";

interface SimplifyPoint {
  x: number;
  y: number;
  __index: number;
}

export const simplifyStroke = (
  points: StrokePoint[],
  tolerance: number,
  highQuality = false
): StrokePoint[] => {
  if (points.length <= 2) return [...points];

  const simplifyInput: SimplifyPoint[] = points.map((point, index) => ({
    x: point.x,
    y: point.y,
    __index: index,
  }));

  const simplified = simplify(
    simplifyInput,
    Math.max(0, tolerance),
    highQuality
  ) as SimplifyPoint[];

  if (simplified.length === 0) return [points[0], points[points.length - 1]];

  return simplified.map((point) => points[point.__index]);
};

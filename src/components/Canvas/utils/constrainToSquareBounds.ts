import { StrokePoint } from "@/types";

export function constrainToSquareBounds(
  start: StrokePoint,
  end: StrokePoint
): StrokePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const size = Math.min(Math.abs(dx), Math.abs(dy));

  return {
    x: start.x + Math.sign(dx) * size,
    y: start.y + Math.sign(dy) * size,
    pressure: end.pressure,
  };
}

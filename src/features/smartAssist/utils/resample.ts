import { StrokePoint } from "@/types";
import { distance, safeDivide } from "./geometry";

export const resamplePolyline = (
  points: StrokePoint[],
  targetCount: number
): StrokePoint[] => {
  if (points.length === 0 || targetCount <= 0) return [];
  if (targetCount === 1) return [points[0]];
  if (points.length === 1) return Array.from({ length: targetCount }, () => points[0]);

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + distance(points[i - 1], points[i]);
  }

  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength === 0) return Array.from({ length: targetCount }, () => points[0]);

  const interval = totalLength / (targetCount - 1);
  const result: StrokePoint[] = [points[0]];

  let segmentIndex = 1;
  for (let i = 1; i < targetCount - 1; i += 1) {
    const targetDistance = interval * i;

    while (
      segmentIndex < cumulative.length - 1 &&
      cumulative[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }

    const prev = points[segmentIndex - 1];
    const next = points[segmentIndex];
    const prevDistance = cumulative[segmentIndex - 1];
    const nextDistance = cumulative[segmentIndex];
    const ratio = safeDivide(targetDistance - prevDistance, nextDistance - prevDistance);

    result.push({
      x: prev.x + (next.x - prev.x) * ratio,
      y: prev.y + (next.y - prev.y) * ratio,
      pressure: prev.pressure + (next.pressure - prev.pressure) * ratio,
    });
  }

  result.push(points[points.length - 1]);
  return result;
};

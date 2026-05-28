export interface PointLike {
  x: number;
  y: number;
}

export const distanceSq = (a: PointLike, b: PointLike): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
};

export const distance = (a: PointLike, b: PointLike): number =>
  Math.sqrt(distanceSq(a, b));

export const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value));

export const safeDivide = (
  numerator: number,
  denominator: number,
  fallback = 0
): number => (denominator === 0 ? fallback : numerator / denominator);

export const distanceToSegment = (
  point: PointLike,
  start: PointLike,
  end: PointLike
): number => {
  const segmentLengthSq = distanceSq(start, end);
  if (segmentLengthSq === 0) return distance(point, start);

  const t = clamp01(
    safeDivide(
      (point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y),
      segmentLengthSq
    )
  );

  const projection = {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  };

  return distance(point, projection);
};

export const pathLength = (points: PointLike[]): number => {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
};

export const chordLength = (points: PointLike[]): number => {
  if (points.length < 2) return 0;
  return distance(points[0], points[points.length - 1]);
};

export const angleOfSegment = (start: PointLike, end: PointLike): number =>
  Math.atan2(end.y - start.y, end.x - start.x);

export const normalizeAngleRadians = (angle: number): number => {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized <= -Math.PI) normalized += twoPi;
  if (normalized > Math.PI) normalized -= twoPi;
  return normalized;
};

export const signedAngleDelta = (from: number, to: number): number =>
  normalizeAngleRadians(to - from);

export const angleBetweenSegments = (
  aStart: PointLike,
  aEnd: PointLike,
  bStart: PointLike,
  bEnd: PointLike
): number => {
  const a = angleOfSegment(aStart, aEnd);
  const b = angleOfSegment(bStart, bEnd);
  return Math.abs(signedAngleDelta(a, b));
};

export const centroid = (points: PointLike[]): PointLike | null => {
  if (points.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }

  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
};

export const projectPointToLine = (
  point: PointLike,
  lineStart: PointLike,
  lineEnd: PointLike
): PointLike => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const denominator = dx * dx + dy * dy;

  if (denominator === 0) {
    return { x: lineStart.x, y: lineStart.y };
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    denominator;

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
};

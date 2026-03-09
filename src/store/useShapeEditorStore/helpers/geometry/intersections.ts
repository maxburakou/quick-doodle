import { ShapeBounds, StrokePoint } from "@/types";

const isPointOnRect = (
  point: Pick<StrokePoint, "x" | "y">,
  rect: ShapeBounds
) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const orientation = (
  a: Pick<StrokePoint, "x" | "y">,
  b: Pick<StrokePoint, "x" | "y">,
  c: Pick<StrokePoint, "x" | "y">
) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
};

export const onSegment = (
  a: Pick<StrokePoint, "x" | "y">,
  b: Pick<StrokePoint, "x" | "y">,
  c: Pick<StrokePoint, "x" | "y">
) =>
  b.x <= Math.max(a.x, c.x) &&
  b.x >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) &&
  b.y >= Math.min(a.y, c.y);

export const segmentsIntersect = (
  a1: Pick<StrokePoint, "x" | "y">,
  a2: Pick<StrokePoint, "x" | "y">,
  b1: Pick<StrokePoint, "x" | "y">,
  b2: Pick<StrokePoint, "x" | "y">
) => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;

  return false;
};

export const segmentIntersectsRect = (
  start: Pick<StrokePoint, "x" | "y">,
  end: Pick<StrokePoint, "x" | "y">,
  rect: ShapeBounds
) => {
  if (isPointOnRect(start, rect) || isPointOnRect(end, rect)) return true;

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
};

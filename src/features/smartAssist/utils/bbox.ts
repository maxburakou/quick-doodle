import { Stroke, StrokePoint } from "@/types";
import { distance } from "./geometry";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getPointsBBox = (points: StrokePoint[]): BBox | null => {
  if (points.length === 0) return null;

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, minY, maxX, maxY };
};

export const getStrokeBBox = (stroke: Stroke): BBox | null =>
  getPointsBBox(stroke.points);

export const getStrokesBBox = (strokes: Stroke[]): BBox | null => {
  let bbox: BBox | null = null;

  for (const stroke of strokes) {
    const strokeBBox = getStrokeBBox(stroke);
    if (!strokeBBox) continue;

    if (!bbox) {
      bbox = { ...strokeBBox };
      continue;
    }

    if (strokeBBox.minX < bbox.minX) bbox.minX = strokeBBox.minX;
    if (strokeBBox.minY < bbox.minY) bbox.minY = strokeBBox.minY;
    if (strokeBBox.maxX > bbox.maxX) bbox.maxX = strokeBBox.maxX;
    if (strokeBBox.maxY > bbox.maxY) bbox.maxY = strokeBBox.maxY;
  }

  return bbox;
};

export const getBBoxCenter = (bbox: BBox): StrokePoint => ({
  x: (bbox.minX + bbox.maxX) / 2,
  y: (bbox.minY + bbox.maxY) / 2,
  pressure: 0.5,
});

export const getBBoxDiagonal = (bbox: BBox): number =>
  distance(
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY }
  );

export const expandBBox = (bbox: BBox, paddingPx: number): BBox => ({
  minX: bbox.minX - paddingPx,
  minY: bbox.minY - paddingPx,
  maxX: bbox.maxX + paddingPx,
  maxY: bbox.maxY + paddingPx,
});

export const isPointInBBox = (point: StrokePoint, bbox: BBox): boolean =>
  point.x >= bbox.minX &&
  point.x <= bbox.maxX &&
  point.y >= bbox.minY &&
  point.y <= bbox.maxY;

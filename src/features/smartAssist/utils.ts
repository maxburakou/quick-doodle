import { Stroke, StrokePoint } from "@/types";
import { SmartAssistBatch } from "./types";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getStrokeBBox = (stroke: Stroke): BBox | null => {
  if (stroke.points.length === 0) return null;

  let minX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxX = stroke.points[0].x;
  let maxY = stroke.points[0].y;

  for (let i = 1; i < stroke.points.length; i += 1) {
    const point = stroke.points[i];
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, minY, maxX, maxY };
};

export const getBatchBBox = (batch: SmartAssistBatch): BBox | null => {
  let bbox: BBox | null = null;

  for (const stroke of batch.strokes) {
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

export const countBatchRawPoints = (batch: SmartAssistBatch): number =>
  batch.strokes.reduce((acc, stroke) => acc + stroke.points.length, 0);

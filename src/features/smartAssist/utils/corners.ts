import { StrokePoint } from "@/types";
import { angleBetweenSegments, distance } from "./geometry";

export interface CornerExtractionOptions {
  minAngleRadians?: number;
  minPointSpacing?: number;
}

export const mergeNearbyPoints = (
  points: StrokePoint[],
  thresholdPx: number
): StrokePoint[] => {
  if (points.length <= 1) return [...points];

  const threshold = Math.max(0, thresholdPx);
  const merged: StrokePoint[] = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const prev = merged[merged.length - 1];
    const next = points[i];

    if (distance(prev, next) <= threshold) {
      merged[merged.length - 1] = {
        x: (prev.x + next.x) / 2,
        y: (prev.y + next.y) / 2,
        pressure: (prev.pressure + next.pressure) / 2,
      };
    } else {
      merged.push(next);
    }
  }

  return merged;
};

export const extractCornersFromSimplifiedStroke = (
  simplifiedPoints: StrokePoint[],
  options: CornerExtractionOptions = {}
): StrokePoint[] => {
  if (simplifiedPoints.length <= 2) return [...simplifiedPoints];

  const minAngle = options.minAngleRadians ?? Math.PI / 6;
  const minSpacing = options.minPointSpacing ?? 3;

  const corners: StrokePoint[] = [simplifiedPoints[0]];

  for (let i = 1; i < simplifiedPoints.length - 1; i += 1) {
    const prev = simplifiedPoints[i - 1];
    const current = simplifiedPoints[i];
    const next = simplifiedPoints[i + 1];

    const turn = angleBetweenSegments(prev, current, current, next);
    if (turn < minAngle) continue;

    if (distance(corners[corners.length - 1], current) < minSpacing) continue;
    corners.push(current);
  }

  const last = simplifiedPoints[simplifiedPoints.length - 1];
  if (distance(corners[corners.length - 1], last) >= minSpacing) {
    corners.push(last);
  } else {
    corners[corners.length - 1] = last;
  }

  return corners;
};

export const mergeEndpointsForStrokeGraph = (
  strokes: StrokePoint[][],
  thresholdPx: number
): StrokePoint[][] => {
  if (strokes.length === 0) return [];

  const threshold = Math.max(0, thresholdPx);
  const endpoints = strokes
    .map((stroke, strokeIndex) => {
      if (stroke.length === 0) return [];
      return [
        { strokeIndex, pointIndex: 0, point: stroke[0] },
        {
          strokeIndex,
          pointIndex: stroke.length - 1,
          point: stroke[stroke.length - 1],
        },
      ];
    })
    .flat();

  const groups: typeof endpoints[] = [];
  for (const endpoint of endpoints) {
    let foundGroup = -1;
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i].some((candidate) => distance(candidate.point, endpoint.point) <= threshold)) {
        foundGroup = i;
        break;
      }
    }

    if (foundGroup === -1) {
      groups.push([endpoint]);
    } else {
      groups[foundGroup].push(endpoint);
    }
  }

  const copy = strokes.map((stroke) => [...stroke]);

  for (const group of groups) {
    if (group.length < 2) continue;

    const center = group.reduce(
      (acc, item) => {
        acc.x += item.point.x;
        acc.y += item.point.y;
        acc.pressure += item.point.pressure;
        return acc;
      },
      { x: 0, y: 0, pressure: 0 }
    );

    const mergedPoint: StrokePoint = {
      x: center.x / group.length,
      y: center.y / group.length,
      pressure: center.pressure / group.length,
    };

    for (const item of group) {
      copy[item.strokeIndex][item.pointIndex] = mergedPoint;
    }
  }

  return copy;
};

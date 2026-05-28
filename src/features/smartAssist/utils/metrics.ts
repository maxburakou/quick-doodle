import { Stroke } from "@/types";
import { BBox, getStrokeBBox, getStrokesBBox } from "./bbox";
import { chordLength, pathLength, safeDivide } from "./geometry";

export interface SmartStrokeMetrics {
  id: string;
  pointCount: number;
  pathLength: number;
  chordLength: number;
  straightness: number;
  bbox: BBox | null;
}

export interface SmartBatchMetrics {
  strokeCount: number;
  totalPointCount: number;
  totalPathLength: number;
  totalChordLength: number;
  bbox: BBox | null;
  strokes: SmartStrokeMetrics[];
}

export const buildStrokeMetrics = (stroke: Stroke): SmartStrokeMetrics => {
  const points = stroke.points;
  const strokePathLength = pathLength(points);
  const strokeChordLength = chordLength(points);

  return {
    id: stroke.id,
    pointCount: points.length,
    pathLength: strokePathLength,
    chordLength: strokeChordLength,
    straightness: safeDivide(strokeChordLength, strokePathLength),
    bbox: getStrokeBBox(stroke),
  };
};

export const buildBatchMetrics = (strokes: Stroke[]): SmartBatchMetrics => {
  const strokeMetrics = strokes.map(buildStrokeMetrics);

  const totalPointCount = strokeMetrics.reduce(
    (sum, metrics) => sum + metrics.pointCount,
    0
  );
  const totalPathLength = strokeMetrics.reduce(
    (sum, metrics) => sum + metrics.pathLength,
    0
  );
  const totalChordLength = strokeMetrics.reduce(
    (sum, metrics) => sum + metrics.chordLength,
    0
  );

  return {
    strokeCount: strokes.length,
    totalPointCount,
    totalPathLength,
    totalChordLength,
    bbox: getStrokesBBox(strokes),
    strokes: strokeMetrics,
  };
};

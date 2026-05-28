import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, Tool } from "@/types";
import { ShapeRecognizer } from "../types";
import { distanceToSegment, safeDivide } from "../utils";

const MIN_CHORD_LENGTH_PX = 24;
const STRAIGHTNESS_STRONG = 0.94;
const DEVIATION_AVG_STRONG = 0.02;
const DEVIATION_MAX_STRONG = 0.06;
const CLOSEDNESS_LOOKS_CLOSED = 0.2;

const buildLineReplacementStroke = (stroke: Stroke): Stroke => {
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1] ?? first;

  return {
    id: createStrokeId(),
    tool: Tool.Line,
    points: [first, last],
    color: stroke.color,
    thickness: stroke.thickness,
    drawableSeed: stroke.drawableSeed,
  };
};

export const lineRecognizer: ShapeRecognizer = {
  kind: "line",
  detect: (metrics, context) => {
    if (metrics.strokeCount !== 1) return null;

    const strokeMetrics = metrics.strokes[0];
    const stroke = context.sourceStrokes[0];
    if (!stroke || stroke.points.length < 2) return null;

    if (strokeMetrics.chordLength < MIN_CHORD_LENGTH_PX) return null;

    const first = stroke.points[0];
    const last = stroke.points[stroke.points.length - 1] ?? first;

    let totalDistance = 0;
    let maxDistance = 0;
    for (const point of stroke.points) {
      const currentDistance = distanceToSegment(point, first, last);
      totalDistance += currentDistance;
      if (currentDistance > maxDistance) {
        maxDistance = currentDistance;
      }
    }

    const avgDistance = safeDivide(totalDistance, stroke.points.length);
    const avgDeviation = safeDivide(avgDistance, strokeMetrics.chordLength);
    const maxDeviation = safeDivide(maxDistance, strokeMetrics.chordLength);
    const closedness = safeDivide(strokeMetrics.chordLength, strokeMetrics.pathLength);

    if (closedness < CLOSEDNESS_LOOKS_CLOSED) {
      return {
        kind: "line",
        confidence: 0,
        sourceStrokeIds: [stroke.id],
        replacementStrokes: [],
        reasons: ["closedness-too-low"],
        debugGeometry: { closedness },
      };
    }

    const straightnessScore = safeDivide(strokeMetrics.straightness, STRAIGHTNESS_STRONG);
    const avgDeviationScore = 1 - Math.min(1, safeDivide(avgDeviation, DEVIATION_AVG_STRONG));
    const maxDeviationScore = 1 - Math.min(1, safeDivide(maxDeviation, DEVIATION_MAX_STRONG));
    const confidence =
      straightnessScore * 0.5 + avgDeviationScore * 0.25 + maxDeviationScore * 0.25;

    return {
      kind: "line",
      confidence: Math.max(0, Math.min(1, confidence)),
      sourceStrokeIds: [stroke.id],
      replacementStrokes: [buildLineReplacementStroke(stroke)],
      reasons: [
        `straightness:${strokeMetrics.straightness.toFixed(3)}`,
        `avgDeviation:${avgDeviation.toFixed(3)}`,
        `maxDeviation:${maxDeviation.toFixed(3)}`,
      ],
      debugGeometry: {
        chordLength: strokeMetrics.chordLength,
        pathLength: strokeMetrics.pathLength,
        straightness: strokeMetrics.straightness,
        avgDeviation,
        maxDeviation,
        closedness,
      },
    };
  },
};

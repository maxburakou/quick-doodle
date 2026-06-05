import { Stroke, StrokePoint } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";
import { runSingleStrokeShapeRecognition } from "./recognizers";
import { DetectionResult, RecognizerContext, SmartAssistBatch } from "./types";
import {
  getBBoxCenter,
  getBBoxDiagonal,
  getStrokesBBox,
  safeDivide,
} from "./utils";

export interface TextIntentResult {
  probableText: boolean;
  score: number;
  reasons: string[];
  debug?: Record<string, unknown>;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const SINGLE_STROKE_ARROW_TEXT_VETO_CONFIDENCE = 0.24;
const SINGLE_STROKE_LINE_TEXT_VETO_CONFIDENCE = 0.58;

type ShapeCandidate = DetectionResult["candidates"][number];

const getStrokeCenter = (stroke: Stroke): StrokePoint | null => {
  const bbox = getStrokesBBox([stroke]);
  return bbox ? getBBoxCenter(bbox) : null;
};

const getStrokeDiagonal = (stroke: Stroke): number => {
  const bbox = getStrokesBBox([stroke]);
  return bbox ? getBBoxDiagonal(bbox) : 0;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const getProbeStrokes = (strokes: Stroke[]) => {
  const first = strokes[0];
  const secondProbe = strokes.length === 2
    ? strokes[1]
    : strokes[strokes.length - 2];

  return [first, secondProbe].filter((stroke): stroke is Stroke => Boolean(stroke));
};

const getRejectedProbeScore = (
  strokes: Stroke[],
  context: RecognizerContext
) => {
  const probeResults = getProbeStrokes(strokes).map((stroke) =>
    runSingleStrokeShapeRecognition(stroke, context)
  );
  const rejectedCount = probeResults.filter((result) => !result.accepted).length;

  return {
    score: safeDivide(rejectedCount, Math.max(1, probeResults.length)),
    acceptedCount: probeResults.length - rejectedCount,
  };
};

const getHorizontalFlowScore = (strokes: Stroke[]) => {
  const centers = strokes
    .map(getStrokeCenter)
    .filter((center): center is StrokePoint => Boolean(center));
  if (centers.length < 2) return 0;

  let forwardCount = 0;
  for (let index = 1; index < centers.length; index += 1) {
    if (centers[index].x >= centers[index - 1].x) {
      forwardCount += 1;
    }
  }

  return safeDivide(forwardCount, centers.length - 1);
};

const getLineConsistencyScore = (strokes: Stroke[], batchHeight: number) => {
  const centers = strokes
    .map(getStrokeCenter)
    .filter((center): center is StrokePoint => Boolean(center));
  if (centers.length < 2 || batchHeight <= 0) return 0;

  const averageY = centers.reduce((sum, center) => sum + center.y, 0) / centers.length;
  const maxDelta = centers.reduce(
    (max, center) => Math.max(max, Math.abs(center.y - averageY)),
    0
  );

  return clamp01(1 - safeDivide(maxDelta, batchHeight));
};

const getDebugNumber = (candidate: ShapeCandidate, key: string) => {
  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return null;

  const value = (debugGeometry as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
};

const hasArrowHeadEvidence = (candidate: ShapeCandidate) =>
  candidate.kind === "arrow" &&
  (candidate.reasons.some(
    (reason) => reason === "headEvidence:weak" || reason === "headEvidence:strong"
  ) ||
    (getDebugNumber(candidate, "headArmCount") ?? 0) >= 1 ||
    (getDebugNumber(candidate, "terminalSpreadScore") ?? 0) >= 0.35);

const getSingleStrokeShapeTextVeto = (shapeResult: DetectionResult) => {
  const candidates = [
    ...(shapeResult.winner ? [shapeResult.winner] : []),
    ...shapeResult.candidates,
  ];

  return candidates
    .filter((candidate) => {
      if (candidate.kind === "arrow") {
        return (
          candidate.confidence >= SINGLE_STROKE_ARROW_TEXT_VETO_CONFIDENCE &&
          (hasArrowHeadEvidence(candidate) ||
            shapeResult.rejectedReason === "weak-arrow-head")
        );
      }

      if (candidate.kind === "line") {
        return candidate.confidence >= SINGLE_STROKE_LINE_TEXT_VETO_CONFIDENCE;
      }

      return false;
    })
    .sort((left, right) => right.confidence - left.confidence)[0] ?? null;
};

const getSingleStrokeTextScore = (stroke: Stroke) => {
  const bbox = getStrokesBBox([stroke]);
  if (!bbox) {
    return {
      score: 0,
      reasons: ["single-stroke-empty-bbox"],
      debug: {
        width: 0,
        height: 0,
        aspectRatio: 0,
        pointCountScore: 0,
        aspectScore: 0,
        straightnessScore: 0,
        baselineScore: 0,
      },
    };
  }

  const width = Math.max(1, bbox.maxX - bbox.minX);
  const height = Math.max(1, bbox.maxY - bbox.minY);
  const aspectRatio = width / height;
  const centerStartDeltaY = Math.abs(
    (stroke.points[0]?.y ?? 0) - (stroke.points[stroke.points.length - 1]?.y ?? 0)
  );
  const totalTravelX = stroke.points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + Math.max(0, point.x - stroke.points[index - 1].x);
  }, 0);

  const pointCountScore = clamp01(safeDivide(stroke.points.length - 8, 18));
  const aspectScore = clamp01(safeDivide(aspectRatio - 1, 2.2));
  const straightnessScore = clamp01(
    1 - safeDivide(Math.abs(totalTravelX - width), Math.max(width, 1))
  );
  const baselineScore = clamp01(1 - safeDivide(centerStartDeltaY, height * 0.85));

  const reasons: string[] = [];
  if (pointCountScore >= 0.35) reasons.push("single-stroke-many-points");
  if (aspectScore >= 0.35) reasons.push("single-stroke-wide-bbox");
  if (straightnessScore >= 0.45) reasons.push("single-stroke-left-to-right-travel");
  if (baselineScore >= 0.45) reasons.push("single-stroke-baseline-aligned");

  return {
    score: clamp01(
      pointCountScore * 0.28 +
        aspectScore * 0.3 +
        straightnessScore * 0.24 +
        baselineScore * 0.18
    ),
    reasons,
    debug: {
      width,
      height,
      aspectRatio,
      pointCount: stroke.points.length,
      pointCountScore,
      aspectScore,
      straightnessScore,
      baselineScore,
      totalTravelX,
      startEndDeltaY: centerStartDeltaY,
    },
  };
};

const getMultiStrokeTextShapeScore = (
  batch: SmartAssistBatch,
  shapeResult: DetectionResult | null,
  context: RecognizerContext | null
): TextIntentResult => {
  const reasons: string[] = [];
  const bbox = getStrokesBBox(batch.strokes);
  if (!bbox) {
    return { probableText: false, score: 0, reasons: ["empty-bbox"] };
  }

  const width = Math.max(1, bbox.maxX - bbox.minX);
  const height = Math.max(1, bbox.maxY - bbox.minY);
  const aspectRatio = width / height;
  const batchDiagonal = Math.max(1, getBBoxDiagonal(bbox));
  const strokeDiagonals = batch.strokes.map(getStrokeDiagonal).filter(Boolean);
  const medianStrokeToBatchRatio = safeDivide(median(strokeDiagonals), batchDiagonal);
  const probe = context
    ? getRejectedProbeScore(batch.strokes, context)
    : { score: 0, acceptedCount: 0 };

  if (context && probe.acceptedCount === 0) reasons.push("probe-strokes-not-shapes");
  if (shapeResult && !shapeResult.accepted) reasons.push("shape-recognition-rejected");

  const aspectScore = clamp01((aspectRatio - 1) / 1.8);
  if (aspectScore >= 0.5) reasons.push("wide-text-like-bbox");

  const flowScore = getHorizontalFlowScore(batch.strokes);
  if (flowScore >= 0.65) reasons.push("left-to-right-flow");

  const lineScore = getLineConsistencyScore(batch.strokes, height);
  if (lineScore >= 0.55) reasons.push("single-line-centers");

  const glyphScaleScore = clamp01(1 - safeDivide(medianStrokeToBatchRatio, 0.62));
  if (glyphScaleScore >= 0.45) reasons.push("small-glyph-like-strokes");

  const score = context
    ? clamp01(
        probe.score * 0.34 +
          aspectScore * 0.22 +
          flowScore * 0.18 +
          lineScore * 0.14 +
          glyphScaleScore * 0.12
      )
    : clamp01(
        aspectScore * 0.34 +
          flowScore * 0.28 +
          lineScore * 0.22 +
          glyphScaleScore * 0.16
      );

  return {
    probableText: score >= SMART_ASSIST_CONFIG.text.intentThreshold,
    score,
    reasons,
    debug: {
      mode: context ? "multi-stroke" : "multi-stroke-early",
      threshold: SMART_ASSIST_CONFIG.text.intentThreshold,
      probeScore: probe.score,
      aspectScore,
      flowScore,
      lineScore,
      glyphScaleScore,
      aspectRatio,
      width,
      height,
    },
  };
};

export const detectEarlyTextIntent = (
  batch: SmartAssistBatch
): TextIntentResult => {
  if (batch.strokes.length < SMART_ASSIST_CONFIG.text.earlyIntentMinStrokes) {
    return { probableText: false, score: 0, reasons: ["too-few-strokes"] };
  }

  const result = getMultiStrokeTextShapeScore(batch, null, null);
  return {
    ...result,
    probableText: result.score >= SMART_ASSIST_CONFIG.text.earlyIntentThreshold,
    debug: {
      ...(result.debug ?? {}),
      threshold: SMART_ASSIST_CONFIG.text.earlyIntentThreshold,
    },
  };
};

export const detectTextIntent = (
  batch: SmartAssistBatch,
  shapeResult: DetectionResult,
  context: RecognizerContext
): TextIntentResult => {
  if (batch.strokes.length < 2) {
    const firstStroke = batch.strokes[0];
    if (!firstStroke) {
      return { probableText: false, score: 0, reasons: ["too-few-strokes"] };
    }

    const threshold = SMART_ASSIST_CONFIG.text.singleStrokeIntentThreshold;
    const singleStrokeIntent = getSingleStrokeTextScore(firstStroke);
    const shapeTextVeto = getSingleStrokeShapeTextVeto(shapeResult);
    if (shapeTextVeto) {
      return {
        probableText: false,
        score: singleStrokeIntent.score,
        reasons: [
          ...singleStrokeIntent.reasons,
          `single-stroke-shape-veto:${shapeTextVeto.kind}`,
        ],
        debug: {
          mode: "single-stroke",
          threshold,
          vetoShapeKind: shapeTextVeto.kind,
          vetoShapeConfidence: shapeTextVeto.confidence,
          ...(singleStrokeIntent.debug ?? {}),
        },
      };
    }

    return {
      probableText: singleStrokeIntent.score >= threshold,
      score: singleStrokeIntent.score,
      reasons: singleStrokeIntent.reasons,
      debug: {
        mode: "single-stroke",
        threshold,
        ...(singleStrokeIntent.debug ?? {}),
      },
    };
  }

  return getMultiStrokeTextShapeScore(batch, shapeResult, context);
};

export const isPointLikelyContinuingTextBatch = (
  point: StrokePoint,
  batch: SmartAssistBatch
): boolean => {
  const bbox = getStrokesBBox(batch.strokes);
  if (!bbox) return false;

  const padding = SMART_ASSIST_CONFIG.text.joinPaddingPx;
  const insideExpanded =
    point.x >= bbox.minX - padding &&
    point.x <= bbox.maxX + padding &&
    point.y >= bbox.minY - padding &&
    point.y <= bbox.maxY + padding;
  if (insideExpanded) return true;

  const height = Math.max(1, bbox.maxY - bbox.minY);
  const centerY = (bbox.minY + bbox.maxY) / 2;
  const verticalDelta = Math.abs(point.y - centerY);
  const horizontalContinuation =
    point.x >= bbox.minX - padding && point.x <= bbox.maxX + padding * 1.6;

  return verticalDelta <= Math.max(padding * 0.55, height * 0.8) && horizontalContinuation;
};

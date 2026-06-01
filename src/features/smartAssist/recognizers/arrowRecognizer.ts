import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, StrokePoint, Tool } from "@/types";
import { ShapeDetectionCandidate, ShapeRecognizer } from "../types";
import {
  clamp01,
  chordLength,
  distance,
  distanceToSegment,
  getStrokeBBox,
  pathLength,
  signedAngleDelta,
  safeDivide,
  simplifyStroke,
} from "../utils";
import { getAngleSnapIntent } from "./angleSnapIntent";

const MIN_SHAFT_LENGTH_PX = 32;
const MIN_ARM_LENGTH_PX = 8;
const MIN_ARM_ANGLE_RAD = (6 * Math.PI) / 180;
const MAX_ARM_ANGLE_RAD = (88 * Math.PI) / 180;
const MAX_HEAD_SCAN_FROM_PATH_START = 0.45;
const HEAD_SCAN_SEGMENT_COUNT = 8;
const MAX_PATH_TO_SHAFT_RATIO = 3.2;
const MAX_TERMINAL_TO_SHAFT_RATIO = 1.8;
const CLOSED_LOOP_CHORD_TO_PATH_RATIO = 0.24;

interface TipCandidate {
  tip: StrokePoint;
  tipIndex: number;
  shaftStart: StrokePoint;
  shaftLength: number;
  straightnessScore: number;
}

interface HeadArm {
  length: number;
  angleRad: number;
  side: number;
  score: number;
  source: "segment" | "region" | "terminal";
}

interface HeadDetectionResult {
  arms: HeadArm[];
  headEvidence: "none" | "weak" | "strong";
  terminalComplexityScore: number;
  terminalPathLength: number;
  terminalBackwardReach: number;
  terminalLateralSpan: number;
  terminalSpreadScore: number;
  maxHeadReach: number;
}

const dot = (a: StrokePoint, b: StrokePoint): number => a.x * b.x + a.y * b.y;

const normalize = (vector: StrokePoint): StrokePoint => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: 0, y: 0, pressure: 1 };
  return { x: vector.x / length, y: vector.y / length, pressure: 1 };
};

const sub = (a: StrokePoint, b: StrokePoint): StrokePoint => ({
  x: a.x - b.x,
  y: a.y - b.y,
  pressure: 1,
});

const angleFromShaftBackToArm = (
  shaftStart: StrokePoint,
  tip: StrokePoint,
  armVector: StrokePoint
): number => {
  const shaftBackAngle = Math.atan2(shaftStart.y - tip.y, shaftStart.x - tip.x);
  const armAngle = Math.atan2(armVector.y, armVector.x);
  return Math.abs(signedAngleDelta(shaftBackAngle, armAngle));
};

const scoreHeadArm = (angleRad: number, length: number, shaftLength: number): number => {
  const angleDeg = (angleRad * 180) / Math.PI;
  const angleScore = 1 - clamp01(Math.abs(angleDeg - 42) / 52);
  const lengthScore = clamp01(length / Math.max(MIN_ARM_LENGTH_PX, shaftLength * 0.18));
  return clamp01(angleScore * 0.7 + lengthScore * 0.3);
};

const buildArrowReplacementStroke = (
  source: Stroke,
  shaftStart: StrokePoint,
  tip: StrokePoint
): Stroke => {
  const snapIntent = getAngleSnapIntent(shaftStart, tip);

  return {
    id: createStrokeId(),
    tool: Tool.Arrow,
    points: [shaftStart, snapIntent.snappedEnd],
    color: source.color,
    thickness: source.thickness,
    drawableSeed: source.drawableSeed,
  };
};

const scoreShaftStraightness = (
  rawPoints: StrokePoint[],
  shaftStart: StrokePoint,
  tip: StrokePoint,
  tipIndex: number,
  thickness: number
): number => {
  const shaftLength = distance(shaftStart, tip);
  const limit = Math.max(8, thickness * 3, shaftLength * 0.08);
  const sampleEnd = Math.max(1, Math.min(rawPoints.length - 1, tipIndex));
  let sumDeviation = 0;
  let maxDeviation = 0;

  for (let i = 0; i <= sampleEnd; i += 1) {
    const deviation = distanceToSegment(rawPoints[i], shaftStart, tip);
    sumDeviation += deviation;
    if (deviation > maxDeviation) maxDeviation = deviation;
  }

  const avgDeviation = safeDivide(sumDeviation, sampleEnd + 1);
  const avgScore = 1 - clamp01(avgDeviation / limit);
  const maxScore = 1 - clamp01(maxDeviation / (limit * 1.8));
  return clamp01(avgScore * 0.7 + maxScore * 0.3);
};

const getTipCandidates = (
  rawPoints: StrokePoint[],
  simplified: StrokePoint[],
  thickness: number
): TipCandidate[] => {
  const first = rawPoints[0];
  const last = rawPoints[rawPoints.length - 1] ?? first;

  let farthestPoint = last;
  let farthestDistance = 0;
  for (const point of rawPoints) {
    const currentDistance = distance(first, point);
    if (currentDistance > farthestDistance) {
      farthestDistance = currentDistance;
      farthestPoint = point;
    }
  }

  const candidatePoints: StrokePoint[] = [farthestPoint];
  let minXPoint = first;
  let maxXPoint = first;
  let minYPoint = first;
  let maxYPoint = first;
  for (const point of rawPoints) {
    if (point.x < minXPoint.x) minXPoint = point;
    if (point.x > maxXPoint.x) maxXPoint = point;
    if (point.y < minYPoint.y) minYPoint = point;
    if (point.y > maxYPoint.y) maxYPoint = point;
  }
  candidatePoints.push(minXPoint, maxXPoint, minYPoint, maxYPoint);

  const addProjectionCandidates = (direction: StrokePoint) => {
    if (direction.x === 0 && direction.y === 0) return;

    const rankedPoints = simplified
      .map((point) => ({
        point,
        projection: dot(sub(point, first), direction),
      }))
      .sort((a, b) => b.projection - a.projection)
      .slice(0, 5)
      .map((entry) => entry.point);

    candidatePoints.push(...rankedPoints);
  };

  addProjectionCandidates(normalize(sub(last, first)));
  addProjectionCandidates(normalize(sub(farthestPoint, first)));

  const dedupedCandidatePoints: StrokePoint[] = [];
  for (const point of candidatePoints) {
    if (
      !dedupedCandidatePoints.some(
        (candidate) => candidate === point || distance(candidate, point) <= 3
      )
    ) {
      dedupedCandidatePoints.push(point);
    }
  }

  return dedupedCandidatePoints
    .map((tip): TipCandidate | null => {
      const tipIndex = rawPoints.findIndex((point) => point === tip);
      if (tipIndex < 1) return null;
      const shaftStart = rawPoints[0];
      const shaftLength = distance(shaftStart, tip);
      if (shaftLength < MIN_SHAFT_LENGTH_PX) return null;
      return {
        tip,
        tipIndex,
        shaftStart,
        shaftLength,
        straightnessScore: scoreShaftStraightness(
          rawPoints,
          shaftStart,
          tip,
          tipIndex,
          thickness
        ),
      };
    })
    .filter((candidate): candidate is TipCandidate => candidate !== null)
    .sort(
      (a, b) =>
        b.straightnessScore * 0.7 +
        safeDivide(b.shaftLength, 240) * 0.3 -
        (a.straightnessScore * 0.7 + safeDivide(a.shaftLength, 240) * 0.3)
    )
    .slice(0, 8);
};

const detectHeadArms = (
  rawPoints: StrokePoint[],
  simplified: StrokePoint[],
  tip: StrokePoint,
  tipIndex: number,
  shaftStart: StrokePoint,
  shaftLength: number,
  thickness: number
): HeadDetectionResult => {
  if (simplified.length < 2) {
    return {
      arms: [],
      headEvidence: "none",
      terminalComplexityScore: 0,
      terminalPathLength: 0,
      terminalBackwardReach: 0,
      terminalLateralSpan: 0,
      terminalSpreadScore: 0,
      maxHeadReach: 0,
    };
  }

  const shaftDirection = normalize(sub(tip, shaftStart));
  const shaftBackDirection = normalize(sub(shaftStart, tip));
  const proximity = Math.max(14, thickness * 3);
  const maxHeadReach = Math.max(72, shaftLength * 1.15);
  const simplifiedPathLength = pathLength(simplified);
  const minScanDistance = simplifiedPathLength * MAX_HEAD_SCAN_FROM_PATH_START;
  const segmentStartIndexByCount = Math.max(0, simplified.length - 1 - HEAD_SCAN_SEGMENT_COUNT);
  let closestTipIndex = 0;
  let closestTipDistance = Infinity;

  for (let i = 0; i < simplified.length; i += 1) {
    const currentDistance = distance(simplified[i], tip);
    if (currentDistance < closestTipDistance) {
      closestTipIndex = i;
      closestTipDistance = currentDistance;
    }
  }

  const arms: HeadArm[] = [];
  const bestRegionArmBySide = new Map<number, HeadArm>();
  const bestTerminalArmBySide = new Map<number, HeadArm>();
  const terminalPoints = rawPoints.slice(Math.max(0, tipIndex));
  const terminalPathLength = pathLength(terminalPoints);
  let terminalBackwardReach = 0;
  let terminalLateralMin = 0;
  let terminalLateralMax = 0;
  let distanceFromStart = 0;

  for (const point of terminalPoints) {
    const armVector = sub(point, tip);
    const armLength = distance(point, tip);
    if (armLength < MIN_ARM_LENGTH_PX || armLength > maxHeadReach) continue;

    const backwardProjection = dot(armVector, shaftBackDirection);
    const lateral = shaftDirection.x * armVector.y - shaftDirection.y * armVector.x;
    terminalBackwardReach = Math.max(terminalBackwardReach, backwardProjection);
    terminalLateralMin = Math.min(terminalLateralMin, lateral);
    terminalLateralMax = Math.max(terminalLateralMax, lateral);

    if (backwardProjection <= Math.max(2, thickness * 0.5)) continue;
    if (Math.abs(lateral) <= Math.max(3, thickness * 0.75)) continue;

    const angleRad = Math.atan2(Math.abs(lateral), backwardProjection);
    if (angleRad < MIN_ARM_ANGLE_RAD || angleRad > MAX_ARM_ANGLE_RAD) continue;

    const side = Math.sign(lateral);
    if (side === 0) continue;

    const score = scoreHeadArm(angleRad, armLength, shaftLength);
    const existing = bestTerminalArmBySide.get(side);
    if (!existing || score > existing.score) {
      bestTerminalArmBySide.set(side, {
        length: armLength,
        angleRad,
        side,
        score,
        source: "terminal",
      });
    }
  }

  for (let i = 0; i < simplified.length - 1; i += 1) {
    const a = simplified[i];
    const b = simplified[i + 1];
    const segmentLength = distance(a, b);
    const shouldScanSegment =
      distanceFromStart >= minScanDistance ||
      i >= segmentStartIndexByCount ||
      i >= closestTipIndex - 1;
    distanceFromStart += segmentLength;
    if (!shouldScanSegment) continue;

    for (const point of [a, b]) {
      const armVector = sub(point, tip);
      const armLength = distance(point, tip);
      if (armLength < MIN_ARM_LENGTH_PX || armLength > maxHeadReach) continue;

      const backwardProjection = dot(armVector, shaftBackDirection);
      if (backwardProjection <= Math.max(4, thickness)) continue;

      const lateral = shaftDirection.x * armVector.y - shaftDirection.y * armVector.x;
      if (Math.abs(lateral) <= Math.max(3, thickness * 0.75)) continue;

      const angleRad = Math.atan2(Math.abs(lateral), backwardProjection);
      if (angleRad < MIN_ARM_ANGLE_RAD || angleRad > MAX_ARM_ANGLE_RAD) continue;

      const side = Math.sign(lateral);
      if (side === 0) continue;

      const score = scoreHeadArm(angleRad, armLength, shaftLength);
      const existing = bestRegionArmBySide.get(side);
      if (!existing || score > existing.score) {
        bestRegionArmBySide.set(side, {
          length: armLength,
          angleRad,
          side,
          score,
          source: "region",
        });
      }
    }

    const aNear = distance(a, tip) <= proximity;
    const bNear = distance(b, tip) <= proximity;
    if (!aNear && !bNear) continue;
    if (aNear && bNear) continue;

    const near = aNear ? a : b;
    const far = aNear ? b : a;
    const armLength = distance(near, far);
    if (armLength < MIN_ARM_LENGTH_PX || armLength > maxHeadReach) continue;

    const armVector = sub(far, near);
    const angleRad = angleFromShaftBackToArm(shaftStart, tip, armVector);
    if (angleRad < MIN_ARM_ANGLE_RAD || angleRad > MAX_ARM_ANGLE_RAD) continue;

    const cross = shaftDirection.x * armVector.y - shaftDirection.y * armVector.x;
    const side = Math.abs(cross) < 1e-4 ? 0 : Math.sign(cross);
    if (side === 0) continue;
    const score = scoreHeadArm(angleRad, armLength, shaftLength);

    const duplicate = arms.some(
      (existing) =>
        existing.side === side &&
        Math.abs(existing.angleRad - angleRad) < 0.12 &&
        Math.abs(existing.length - armLength) < 5
    );
    if (!duplicate) {
      arms.push({ length: armLength, angleRad, side, score, source: "segment" });
    }
  }

  for (const regionArm of bestRegionArmBySide.values()) {
    const existingSameSideIndex = arms.findIndex((arm) => arm.side === regionArm.side);
    if (existingSameSideIndex === -1) {
      arms.push(regionArm);
    } else if (regionArm.score > arms[existingSameSideIndex].score) {
      arms[existingSameSideIndex] = regionArm;
    }
  }

  for (const terminalArm of bestTerminalArmBySide.values()) {
    const existingSameSideIndex = arms.findIndex((arm) => arm.side === terminalArm.side);
    if (existingSameSideIndex === -1) {
      arms.push(terminalArm);
    } else if (terminalArm.score > arms[existingSameSideIndex].score) {
      arms[existingSameSideIndex] = terminalArm;
    }
  }

  const bestBySide = new Map<number, HeadArm>();
  for (const arm of arms) {
    const existing = bestBySide.get(arm.side);
    if (!existing || arm.score > existing.score) {
      bestBySide.set(arm.side, arm);
    }
  }
  const bestArms = [...bestBySide.values()];
  const terminalComplexityScore = clamp01(
    safeDivide(terminalPathLength, Math.max(18, shaftLength * 0.18))
  );
  const terminalLateralSpan = terminalLateralMax - terminalLateralMin;
  const terminalHasBothSides =
    terminalLateralMin <= -Math.max(4, thickness) &&
    terminalLateralMax >= Math.max(4, thickness);
  const terminalSpreadScore =
    terminalHasBothSides
      ? clamp01(
          Math.min(
            safeDivide(terminalBackwardReach, Math.max(10, shaftLength * 0.08)),
            safeDivide(terminalLateralSpan, Math.max(12, shaftLength * 0.12)),
            terminalComplexityScore
          )
        )
      : 0;
  const hasStrongArmEvidence =
    bestArms.length >= 2 &&
    bestArms.some((a) => a.side > 0) &&
    bestArms.some((a) => a.side < 0);
  const hasStrongTerminalSpread = terminalSpreadScore >= 0.65;

  if (hasStrongArmEvidence || hasStrongTerminalSpread) {
    return {
      arms: bestArms,
      headEvidence: "strong",
      terminalComplexityScore,
      terminalPathLength,
      terminalBackwardReach,
      terminalLateralSpan,
      terminalSpreadScore,
      maxHeadReach,
    };
  }
  if (bestArms.length >= 1) {
    return {
      arms: bestArms,
      headEvidence: "weak",
      terminalComplexityScore,
      terminalPathLength,
      terminalBackwardReach,
      terminalLateralSpan,
      terminalSpreadScore,
      maxHeadReach,
    };
  }
  return {
    arms: bestArms,
    headEvidence: "none",
    terminalComplexityScore,
    terminalPathLength,
    terminalBackwardReach,
    terminalLateralSpan,
    terminalSpreadScore,
    maxHeadReach,
  };
};

const buildSingleStrokeArrowCandidate = (
  stroke: Stroke,
  rawPoints: StrokePoint[],
  strokeBBox: ReturnType<typeof getStrokeBBox>,
  strokePathLength: number,
  strokeChordLength: number,
  simplified: StrokePoint[],
  tipCandidate: TipCandidate,
  tipCandidateCount: number
): ShapeDetectionCandidate | null => {
  const { tip, shaftStart, shaftLength, straightnessScore } = tipCandidate;
  const snapIntent = getAngleSnapIntent(shaftStart, tip);
  const {
    arms,
    headEvidence,
    terminalComplexityScore,
    terminalPathLength,
    terminalBackwardReach,
    terminalLateralSpan,
    terminalSpreadScore,
    maxHeadReach,
  } = detectHeadArms(
    rawPoints,
    simplified,
    tip,
    tipCandidate.tipIndex,
    shaftStart,
    shaftLength,
    stroke.thickness
  );

  const shaftLengthScore = clamp01((shaftLength - MIN_SHAFT_LENGTH_PX) / 92);
  const headEvidenceScore =
    headEvidence === "strong" ? 0.95 : headEvidence === "weak" ? 0.45 : 0;

  const headAngles = arms.map((arm) => (arm.angleRad * 180) / Math.PI);
  const chordToPathRatio = safeDivide(strokeChordLength, strokePathLength);
  const pathToShaftRatio = safeDivide(strokePathLength, shaftLength);
  const terminalToShaftRatio = safeDivide(terminalPathLength, shaftLength);
  const headAngleScore =
    arms.length === 0
      ? 0
      : arms.reduce((sum, arm) => {
          const ideal = 42;
          const angleDeg = (arm.angleRad * 180) / Math.PI;
          const score = 1 - clamp01(Math.abs(angleDeg - ideal) / 23);
          return sum + score;
        }, 0) / arms.length;

  let headSymmetryScore = 0;
  const left = arms.find((arm) => arm.side < 0);
  const right = arms.find((arm) => arm.side > 0);
  if (left && right) {
    const lengthSymmetry = 1 - clamp01(Math.abs(left.length - right.length) / Math.max(1, shaftLength * 0.25));
    const angleSymmetry =
      1 - clamp01(Math.abs(left.angleRad - right.angleRad) / ((20 * Math.PI) / 180));
    headSymmetryScore = clamp01(lengthSymmetry * 0.5 + angleSymmetry * 0.5);
  } else if (arms.length >= 1) {
    headSymmetryScore = 0.2;
  }

  const tipOverlapCount = rawPoints.filter((point) => distance(point, tip) <= Math.max(8, stroke.thickness * 2)).length;
  const selfOverlapNearTipBonus = clamp01((tipOverlapCount - 2) / 8) * 0.06;

  let confidence =
    straightnessScore * 0.22 +
    shaftLengthScore * 0.14 +
    headEvidenceScore * 0.3 +
    headAngleScore * 0.12 +
    headSymmetryScore * 0.1 +
    Math.max(terminalComplexityScore, terminalSpreadScore) * 0.06 +
    selfOverlapNearTipBonus;

  if (headEvidence === "weak") {
    confidence *= 0.68;
  }
  if (headEvidence === "none") {
    confidence = 0;
  }
  if (headEvidence === "strong" && terminalSpreadScore >= 0.65 && shaftLengthScore >= 0.35) {
    confidence = Math.max(confidence, 0.84 + terminalSpreadScore * 0.05);
  }

  if (pathToShaftRatio > MAX_PATH_TO_SHAFT_RATIO) {
    confidence *= 0.35;
  }
  if (terminalToShaftRatio > MAX_TERMINAL_TO_SHAFT_RATIO) {
    confidence *= 0.35;
  }
  if (chordToPathRatio < CLOSED_LOOP_CHORD_TO_PATH_RATIO) {
    confidence *= 0.35;
  }

  confidence = clamp01(confidence);

  return {
    kind: "arrow",
    confidence,
    sourceStrokeIds: [stroke.id],
    replacementStrokes: [buildArrowReplacementStroke(stroke, shaftStart, tip)],
    reasons: [
      `headEvidence:${headEvidence}`,
      `shaftLength:${shaftLength.toFixed(1)}`,
      `headArmCount:${arms.length}`,
      `headAngles:${headAngles.map((angle) => angle.toFixed(1)).join(",") || "none"}`,
      ...(snapIntent.shouldSnap
        ? [
            `guideSnap:${snapIntent.guideKind}`,
            `guideAngle:${snapIntent.snappedAngleDeg.toFixed(0)}`,
          ]
        : []),
    ],
    debugGeometry: {
      bbox: strokeBBox,
      pathLength: strokePathLength,
      chordLength: strokeChordLength,
      tip,
      shaftStart,
      shaftLength,
      shaftStraightnessScore: straightnessScore,
      shaftLengthScore,
      headEvidence,
      headEvidenceScore,
      headArmCount: arms.length,
      headAngles,
      headAngleScore,
      headSymmetryScore,
      terminalComplexityScore,
      terminalPathLength,
      terminalBackwardReach,
      terminalLateralSpan,
      terminalSpreadScore,
      maxHeadReach,
      chordToPathRatio,
      pathToShaftRatio,
      terminalToShaftRatio,
      tipCandidateCount,
      selfOverlapNearTipBonus,
      angleDeg: snapIntent.angleDeg,
      angleSnapDeltaDeg: snapIntent.deltaDeg,
      angleSnapEndpointShiftPx: snapIntent.endpointShiftPx,
      snappedAngleDeg: snapIntent.snappedAngleDeg,
      angleSnapApplied: snapIntent.shouldSnap,
      snapGuideKind: snapIntent.guideKind,
      snappedEnd: snapIntent.snappedEnd,
    },
  };
};

const detectSingleStrokeArrow = (
  stroke: Stroke
): ShapeDetectionCandidate | null => {
  if (stroke.points.length < 6) return null;

  const rawPoints = stroke.points;
  const strokeBBox = getStrokeBBox(stroke);
  const strokePathLength = pathLength(rawPoints);
  const strokeChordLength = chordLength(rawPoints);
  const simplified = simplifyStroke(rawPoints, Math.max(1.6, stroke.thickness * 0.65), true);
  const tipCandidates = getTipCandidates(rawPoints, simplified, stroke.thickness);
  if (tipCandidates.length === 0) return null;

  return tipCandidates
    .map((tipCandidate) =>
      buildSingleStrokeArrowCandidate(
        stroke,
        rawPoints,
        strokeBBox,
        strokePathLength,
        strokeChordLength,
        simplified,
        tipCandidate,
        tipCandidates.length
      )
    )
    .filter((candidate): candidate is ShapeDetectionCandidate => candidate !== null)
    .sort((a, b) => {
      const aStrong = a.reasons.some((reason) => reason === "headEvidence:strong");
      const bStrong = b.reasons.some((reason) => reason === "headEvidence:strong");
      if (aStrong !== bStrong) return bStrong ? 1 : -1;
      return b.confidence - a.confidence;
    })[0] ?? null;
};

export const arrowRecognizer: ShapeRecognizer = {
  kind: "arrow",
  detect: (metrics, context) => {
    if (metrics.strokeCount !== 1) return null;

    const stroke = context.sourceStrokes[0];
    if (!stroke || stroke.points.length < 2) return null;
    return detectSingleStrokeArrow(stroke);
  },
};

import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, StrokePoint, Tool } from "@/types";
import { ShapeRecognizer } from "../types";
import {
  angleBetweenSegments,
  clamp01,
  distance,
  getPointsBBox,
  getBBoxDiagonal,
  safeDivide,
  simplifyStroke,
} from "../utils";

const MIN_BBOX_SIZE_PX = 16;
const MIN_BBOX_DIAGONAL_PX = 24;
const MAX_CLOSEDNESS = 0.16;
const MAX_LOOSE_CLOSEDNESS = 0.72;
const MAX_LOOP_JOIN_RATIO = 0.14;
const MIN_LOOP_INDEX_SPAN_RATIO = 0.45;
const MIN_LOOP_PATH_TO_DIAGONAL_RATIO = 1.6;
const MIN_ANGULAR_COVERAGE = 0.82;

const RADIAL_MEAN_GOOD = 0.28;
const RADIAL_STD_GOOD = 0.3;

const QUADRANT_FULL_COVERAGE = 4;

interface LoopTrace {
  points: StrokePoint[];
  closureGap: number;
  startIndex: number;
  endIndex: number;
  trimmedEndpointCount: number;
}

interface EllipseEvaluation {
  trace: LoopTrace;
  confidence: number;
  closedness: number;
  angularCoverage: number;
  radialMeanError: number;
  radialStd: number;
  quadrantCoverage: number;
  cornerPenalty: number;
  width: number;
  height: number;
  diagonal: number;
  orientedWidth: number;
  orientedHeight: number;
  rotation: number;
  rotationReliable: boolean;
  bbox: NonNullable<ReturnType<typeof getPointsBBox>>;
}

const buildCumulativePathLengths = (points: StrokePoint[]): number[] => {
  const cumulative = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + distance(points[i - 1], points[i]);
  }
  return cumulative;
};

const getPathSpan = (
  cumulativePathLengths: number[],
  startIndex: number,
  endIndex: number
): number => cumulativePathLengths[endIndex] - cumulativePathLengths[startIndex];

const buildTrace = (
  points: StrokePoint[],
  startIndex: number,
  endIndex: number
): LoopTrace => ({
  points: points.slice(startIndex, endIndex + 1),
  closureGap: distance(points[startIndex], points[endIndex]),
  startIndex,
  endIndex,
  trimmedEndpointCount: startIndex + (points.length - 1 - endIndex),
});

const extractBestLoopTrace = (points: StrokePoint[]): LoopTrace | null => {
  if (points.length < 8) return null;

  const bbox = getPointsBBox(points);
  if (!bbox) return null;

  const diagonal = getBBoxDiagonal(bbox);
  if (diagonal === 0) return null;

  const cumulativePathLengths = buildCumulativePathLengths(points);
  const maxJoinDistance = Math.max(10, Math.min(36, diagonal * MAX_LOOP_JOIN_RATIO));
  const minIndexSpan = Math.max(
    8,
    Math.floor(points.length * MIN_LOOP_INDEX_SPAN_RATIO)
  );
  const minPathSpan = diagonal * MIN_LOOP_PATH_TO_DIAGONAL_RATIO;

  let best: LoopTrace | null = null;
  let bestScore = -Infinity;

  for (let startIndex = 0; startIndex < points.length - minIndexSpan; startIndex += 1) {
    for (let endIndex = startIndex + minIndexSpan; endIndex < points.length; endIndex += 1) {
      const closureGap = distance(points[startIndex], points[endIndex]);
      if (closureGap > maxJoinDistance) continue;

      const pathSpan = getPathSpan(cumulativePathLengths, startIndex, endIndex);
      if (pathSpan < minPathSpan) continue;

      const trimmedEndpointCount = startIndex + (points.length - 1 - endIndex);
      const score =
        pathSpan -
        closureGap * 4 -
        trimmedEndpointCount * Math.max(1, diagonal * 0.01);

      if (score > bestScore) {
        bestScore = score;
        best = buildTrace(points, startIndex, endIndex);
      }
    }
  }

  if (best) return best;

  return buildTrace(points, 0, points.length - 1);
};

const buildCandidateTraces = (points: StrokePoint[]): LoopTrace[] => {
  const traces: LoopTrace[] = [];
  const addTrace = (trace: LoopTrace | null) => {
    if (!trace || trace.points.length < 8) return;
    const duplicate = traces.some(
      (candidate) =>
        candidate.startIndex === trace.startIndex &&
        candidate.endIndex === trace.endIndex
    );
    if (!duplicate) traces.push(trace);
  };

  addTrace(extractBestLoopTrace(points));
  addTrace(buildTrace(points, 0, points.length - 1));

  const maxTrim = Math.min(36, Math.floor(points.length * 0.45));
  const step = Math.max(2, Math.floor(maxTrim / 5));
  const trimOptions = new Set<number>([0, 1, 2, 3, maxTrim]);
  for (let trim = step; trim < maxTrim; trim += step) {
    trimOptions.add(trim);
  }

  for (const startTrim of trimOptions) {
    for (const endTrim of trimOptions) {
      const startIndex = startTrim;
      const endIndex = points.length - 1 - endTrim;
      if (endIndex - startIndex < Math.max(8, points.length * 0.4)) continue;
      addTrace(buildTrace(points, startIndex, endIndex));
    }
  }

  return traces;
};

const computeQuadrantCoverage = (
  points: StrokePoint[],
  cx: number,
  cy: number
): number => {
  let q1 = false;
  let q2 = false;
  let q3 = false;
  let q4 = false;

  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    if (dx >= 0 && dy < 0) q1 = true;
    else if (dx < 0 && dy < 0) q2 = true;
    else if (dx < 0 && dy >= 0) q3 = true;
    else if (dx >= 0 && dy >= 0) q4 = true;
  }

  return Number(q1) + Number(q2) + Number(q3) + Number(q4);
};

const computeAngularCoverage = (
  points: StrokePoint[],
  cx: number,
  cy: number
): number => {
  if (points.length < 2) return 0;

  const angles = points
    .map((point) => Math.atan2(point.y - cy, point.x - cx))
    .sort((a, b) => a - b);

  let largestGap = 0;
  for (let i = 1; i < angles.length; i += 1) {
    largestGap = Math.max(largestGap, angles[i] - angles[i - 1]);
  }

  const wrapGap = angles[0] + Math.PI * 2 - angles[angles.length - 1];
  largestGap = Math.max(largestGap, wrapGap);

  return 1 - clamp01(safeDivide(largestGap, Math.PI * 2));
};

const computeCornerPenalty = (
  points: StrokePoint[],
  rx: number,
  ry: number
): { cornerPenalty: number; cornerCount: number } => {
  const tolerance = Math.max(1.5, Math.min(rx, ry) * 0.08);
  const simplified = simplifyStroke(points, tolerance, true);
  if (simplified.length < 5) return { cornerPenalty: 0, cornerCount: 0 };

  let cornerCount = 0;
  let sharpnessSum = 0;
  for (let i = 0; i < simplified.length; i += 1) {
    const prev = simplified[(i - 1 + simplified.length) % simplified.length];
    const curr = simplified[i];
    const next = simplified[(i + 1) % simplified.length];
    const turn = angleBetweenSegments(prev, curr, curr, next);
    if (turn >= 0.75) {
      cornerCount += 1;
      sharpnessSum += turn;
    }
  }

  if (cornerCount === 0) return { cornerPenalty: 0, cornerCount: 0 };

  const cornerNearFour = 1 - clamp01(Math.abs(cornerCount - 4) / 2.5);
  const avgSharpness = safeDivide(sharpnessSum, cornerCount);
  const sharpnessFactor = clamp01(safeDivide(avgSharpness - 0.75, 1.05));
  const cornerPenalty = clamp01(cornerNearFour * sharpnessFactor);

  return { cornerPenalty, cornerCount };
};

const buildEllipseReplacementStroke = (
  source: Stroke,
  topLeft: StrokePoint,
  bottomRight: StrokePoint,
  rotation = 0
): Stroke => ({
  id: createStrokeId(),
  tool: Tool.Ellipse,
  points: [topLeft, bottomRight],
  color: source.color,
  thickness: source.thickness,
  drawableSeed: source.drawableSeed,
  rotation,
});

const computeOrientedEllipseBounds = (
  points: StrokePoint[]
): {
  width: number;
  height: number;
  rotation: number;
  rotationReliable: boolean;
} => {
  if (points.length < 3) {
    return { width: 0, height: 0, rotation: 0, rotationReliable: false };
  }

  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= points.length;
  cy /= points.length;

  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  xx /= points.length;
  yy /= points.length;
  xy /= points.length;

  const rotation = 0.5 * Math.atan2(2 * xy, xx - yy);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const x = dx * cos + dy * sin;
    const y = -dx * sin + dy * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const aspect = safeDivide(Math.min(width, height), Math.max(width, height), 1);
  const rotationReliable = aspect < 0.82;

  if (width >= height) {
    return { width, height, rotation, rotationReliable };
  }

  return {
    width: height,
    height: width,
    rotation: rotation + Math.PI / 2,
    rotationReliable,
  };
};

const evaluateEllipseTrace = (trace: LoopTrace): EllipseEvaluation | null => {
  const loopPoints = trace.points;
  const bbox = getPointsBBox(loopPoints);
  if (!bbox) return null;

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const diagonal = getBBoxDiagonal(bbox);

  if (width < MIN_BBOX_SIZE_PX || height < MIN_BBOX_SIZE_PX || diagonal < MIN_BBOX_DIAGONAL_PX) {
    return null;
  }

  const first = loopPoints[0];
  const last = loopPoints[loopPoints.length - 1];
  const closedness = safeDivide(distance(first, last), diagonal, 1);

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const rx = Math.max(width / 2, 1e-3);
  const ry = Math.max(height / 2, 1e-3);
  const orientedBounds = computeOrientedEllipseBounds(loopPoints);
  const orientedRx = Math.max(orientedBounds.width / 2, 1e-3);
  const orientedRy = Math.max(orientedBounds.height / 2, 1e-3);
  const cos = Math.cos(orientedBounds.rotation);
  const sin = Math.sin(orientedBounds.rotation);

  const quadrantCoverage = computeQuadrantCoverage(loopPoints, cx, cy);
  if (quadrantCoverage < QUADRANT_FULL_COVERAGE) return null;

  const angularCoverage = computeAngularCoverage(loopPoints, cx, cy);
  const isClosedEnough = closedness <= MAX_CLOSEDNESS;
  const isLooseFullLoop =
    closedness <= MAX_LOOSE_CLOSEDNESS &&
    angularCoverage >= MIN_ANGULAR_COVERAGE;
  if (!isClosedEnough && !isLooseFullLoop) return null;

  const axisRadialErrors = loopPoints.map((point) => {
    const dx = safeDivide(point.x - cx, rx);
    const dy = safeDivide(point.y - cy, ry);
    const radius = Math.sqrt(dx * dx + dy * dy);
    return radius - 1;
  });
  const orientedRadialErrors = loopPoints.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    const radius = Math.sqrt(
      safeDivide(localX, orientedRx) ** 2 + safeDivide(localY, orientedRy) ** 2
    );
    return radius - 1;
  });

  const getRadialStats = (errors: number[]) => {
    const meanAbs =
      errors.reduce((sum, err) => sum + Math.abs(err), 0) / errors.length;
    const meanSigned = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const variance =
      errors.reduce((sum, err) => {
        const centered = err - meanSigned;
        return sum + centered * centered;
      }, 0) / errors.length;
    return { meanAbs, std: Math.sqrt(variance) };
  };

  const axisRadialStats = getRadialStats(axisRadialErrors);
  const orientedRadialStats = getRadialStats(orientedRadialErrors);
  const useOrientedFit =
    orientedBounds.rotationReliable &&
    orientedRadialStats.meanAbs + orientedRadialStats.std <
      axisRadialStats.meanAbs + axisRadialStats.std;
  const radialMeanError = useOrientedFit
    ? orientedRadialStats.meanAbs
    : axisRadialStats.meanAbs;
  const radialStd = useOrientedFit ? orientedRadialStats.std : axisRadialStats.std;

  const { cornerPenalty } = computeCornerPenalty(loopPoints, rx, ry);

  const closureScore = isClosedEnough
    ? 1 - clamp01(safeDivide(closedness, MAX_CLOSEDNESS)) * 0.35
    : 0.58 + (angularCoverage - MIN_ANGULAR_COVERAGE) * 0.7;
  const radialMeanScore = 1 - clamp01(safeDivide(radialMeanError, RADIAL_MEAN_GOOD));
  const radialStdScore = 1 - clamp01(safeDivide(radialStd, RADIAL_STD_GOOD));
  const radialFitScore = radialMeanScore * 0.65 + radialStdScore * 0.35;
  const quadrantCoverageScore = quadrantCoverage === 4 ? 1 : 0;
  const angularCoverageScore = clamp01(
    safeDivide(angularCoverage - MIN_ANGULAR_COVERAGE, 1 - MIN_ANGULAR_COVERAGE)
  );
  const smoothnessScore = 1 - cornerPenalty;
  const sizeScore =
    clamp01(safeDivide(Math.min(width, height), 42)) * 0.65 +
    clamp01(safeDivide(diagonal, 84)) * 0.35;
  const trimPenalty = clamp01(safeDivide(trace.trimmedEndpointCount, loopPoints.length) * 0.18);

  const confidenceRaw =
    closureScore * 0.14 +
    radialFitScore * 0.4 +
    quadrantCoverageScore * 0.08 +
    angularCoverageScore * 0.12 +
    smoothnessScore * 0.16 +
    sizeScore * 0.1;
  const confidence = clamp01(confidenceRaw - cornerPenalty * 0.42 - trimPenalty);

  return {
    trace,
    confidence,
    closedness,
    angularCoverage,
    radialMeanError,
    radialStd,
    quadrantCoverage,
    cornerPenalty,
    width,
    height,
    diagonal,
    orientedWidth: orientedBounds.width,
    orientedHeight: orientedBounds.height,
    rotation: useOrientedFit && orientedBounds.rotationReliable ? orientedBounds.rotation : 0,
    rotationReliable: orientedBounds.rotationReliable,
    bbox,
  };
};

export const ellipseRecognizer: ShapeRecognizer = {
  kind: "ellipse",
  detect: (metrics, context) => {
    if (metrics.strokeCount !== 1) return null;

    const sourceStrokes = context.sourceStrokes;
    const mergedPoints = sourceStrokes[0]?.points ?? [];

    if (mergedPoints.length < 8) return null;

    const bestEvaluation = buildCandidateTraces(mergedPoints)
      .map(evaluateEllipseTrace)
      .filter((evaluation): evaluation is EllipseEvaluation => evaluation !== null)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (!bestEvaluation) return null;

    const {
      trace,
      confidence,
      closedness,
      angularCoverage,
      radialMeanError,
      radialStd,
      quadrantCoverage,
      cornerPenalty,
      width,
      height,
      diagonal,
      orientedWidth,
      orientedHeight,
      rotation,
      rotationReliable,
      bbox,
    } = bestEvaluation;

    const topLeft: StrokePoint = {
      x: bbox.minX,
      y: bbox.minY,
      pressure: 0.5,
    };
    const bottomRight: StrokePoint = {
      x: bbox.maxX,
      y: bbox.maxY,
      pressure: 0.5,
    };

    return {
      kind: "ellipse",
      confidence,
      sourceStrokeIds: sourceStrokes.map((stroke) => stroke.id),
      replacementStrokes: [
        buildEllipseReplacementStroke(sourceStrokes[0], topLeft, bottomRight),
      ],
      reasons: [
        `closedness:${closedness.toFixed(3)}`,
        `angularCoverage:${angularCoverage.toFixed(3)}`,
        `radialMeanError:${radialMeanError.toFixed(3)}`,
        `radialStd:${radialStd.toFixed(3)}`,
        `quadrantCoverage:${quadrantCoverage}`,
        `cornerPenalty:${cornerPenalty.toFixed(3)}`,
      ],
      debugGeometry: {
        closedness,
        angularCoverage,
        radialMeanError,
        radialStd,
        quadrantCoverage,
        cornerPenalty,
        width,
        height,
        diagonal,
        orientedWidth,
        orientedHeight,
        rotation,
        rotationReliable,
        loopClosureGap: trace.closureGap,
        loopStartIndex: trace.startIndex,
        loopEndIndex: trace.endIndex,
        trimmedEndpointCount: trace.trimmedEndpointCount,
      },
    };
  },
};

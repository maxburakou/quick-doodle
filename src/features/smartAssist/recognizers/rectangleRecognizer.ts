import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, StrokePoint, Tool } from "@/types";
import { ShapeDetectionCandidate, ShapeRecognizer } from "../types";
import {
  angleBetweenSegments,
  clamp01,
  distance,
  extractCornersFromSimplifiedStroke,
  getBBoxDiagonal,
  getPointsBBox,
  mergeNearbyPoints,
  pathLength,
  resamplePolyline,
  safeDivide,
  signedAngleDelta,
  simplifyStroke,
} from "../utils";

const MAX_SINGLE_CLOSEDNESS = 0.22;
const MIN_BBOX_DIAGONAL = 32;
const MAX_RIGHT_ANGLE_ERROR_DEG = 38;
const MAX_PARALLEL_ERROR_DEG = 32;
const MIN_SIDE_PERIMETER_RATIO = 0.045;
const MIN_SIDE_TO_MAX_SIDE_RATIO = 0.12;
const MAX_DOMINANT_CORNER_CANDIDATES = 8;
const AXIS_SNAP_THRESHOLD_DEG = 12;
const AXIS_SIDE_BAND = 0.36;
const MIN_AXIS_SIDE_COVERAGE = 0.38;
const MIN_AXIS_AREA_RATIO = 0.62;
const CORNER_CONTACT_GOOD = 0.1;
const CORNER_CONTACT_POOR = 0.24;

type BBox = NonNullable<ReturnType<typeof getPointsBBox>>;
type BBoxSide = "top" | "right" | "bottom" | "left";

interface RectangleEval {
  mode: "single-stroke";
  corners: StrokePoint[];
  closureOrGraphScore: number;
  cornerScore: number;
  rawCornerCount: number;
  angleScore: number;
  parallelScore: number;
  sideLengthScore: number;
  confidence: number;
  angleErrors: number[];
  parallelErrors: number[];
  rotation: number;
  rotationReliable: boolean;
  rotationReason?: string;
  snappedToAxis: boolean;
  axisBoxScore?: number;
  sideCoverages?: Record<BBoxSide, number>;
  areaRatio?: number;
  cornerContactScore?: number;
  cornerContactAvgDistance?: number;
  bbox: BBox;
}

const toDeg = (radians: number): number => (radians * 180) / Math.PI;

const getParallelErrorDeg = (a: number, b: number): number => {
  const deltaDeg = Math.abs(toDeg(signedAngleDelta(a, b)));
  return Math.abs(deltaDeg - 180);
};

const getAxisSnapRotation = (rotation: number): { rotation: number; snapped: boolean } => {
  const quarterTurn = Math.PI / 2;
  const nearestQuarterTurn = Math.round(rotation / quarterTurn) * quarterTurn;
  const delta = Math.abs(toDeg(signedAngleDelta(nearestQuarterTurn, rotation)));

  if (delta > AXIS_SNAP_THRESHOLD_DEG) {
    return { rotation, snapped: false };
  }

  // Box-like shapes already encode portrait/landscape through their bounds, so
  // near-axis intent is best represented by no rotation.
  return { rotation: 0, snapped: true };
};

const normalizeCornerLoop = (corners: StrokePoint[]): StrokePoint[] => {
  if (corners.length < 2) return [...corners];
  const loop = [...corners];
  const first = loop[0];
  const last = loop[loop.length - 1];
  if (distance(first, last) <= 1e-6) {
    loop.pop();
  }
  return loop;
};

const mergeCyclicNearbyPoints = (
  points: StrokePoint[],
  thresholdPx: number
): StrokePoint[] => {
  const merged = normalizeCornerLoop(mergeNearbyPoints(points, thresholdPx));
  if (merged.length < 2) return merged;

  const first = merged[0];
  const last = merged[merged.length - 1];
  if (distance(first, last) > thresholdPx) return merged;

  return [
    {
      x: (first.x + last.x) / 2,
      y: (first.y + last.y) / 2,
      pressure: (first.pressure + last.pressure) / 2,
    },
    ...merged.slice(1, -1),
  ];
};

const getOrderedCornersByAngle = (points: StrokePoint[]): StrokePoint[] => {
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  const cx = center.x / points.length;
  const cy = center.y / points.length;

  return [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );
};

const closeCornerRing = (corners: StrokePoint[]): StrokePoint[] => [
  ...corners,
  corners[0],
];

const getAxisAlignedBBoxCorners = (bbox: BBox): StrokePoint[] => [
  { x: bbox.minX, y: bbox.minY, pressure: 1 },
  { x: bbox.maxX, y: bbox.minY, pressure: 1 },
  { x: bbox.maxX, y: bbox.maxY, pressure: 1 },
  { x: bbox.minX, y: bbox.maxY, pressure: 1 },
];

const getCombinationsOfFour = (points: StrokePoint[]): StrokePoint[][] => {
  if (points.length < 4) return [];
  if (points.length === 4) return [[...points]];

  const combinations: StrokePoint[][] = [];
  for (let a = 0; a < points.length - 3; a += 1) {
    for (let b = a + 1; b < points.length - 2; b += 1) {
      for (let c = b + 1; c < points.length - 1; c += 1) {
        for (let d = c + 1; d < points.length; d += 1) {
          combinations.push([points[a], points[b], points[c], points[d]]);
        }
      }
    }
  }
  return combinations;
};

const extractCornerCandidates = (
  points: StrokePoint[],
  diagonal: number,
  tolerance: number
): StrokePoint[] => {
  const simplified = normalizeCornerLoop(simplifyStroke(points, tolerance, true));
  const extracted = extractCornersFromSimplifiedStroke(simplified, {
    minAngleRadians: Math.PI / 6,
    minPointSpacing: Math.max(3, diagonal * 0.045),
  });

  const deduped = mergeCyclicNearbyPoints(extracted, Math.max(4, diagonal * 0.045));
  let corners = normalizeCornerLoop(deduped);

  if (corners.length >= 5) {
    const nearStartEnd = distance(corners[0], corners[corners.length - 1]);
    if (nearStartEnd <= Math.max(6, diagonal * 0.08)) {
      corners = corners.slice(0, -1);
    }
  }

  return corners;
};

const getMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const extractShortStrawCandidates = (
  points: StrokePoint[],
  diagonal: number
): StrokePoint[] => {
  const length = pathLength(points);
  if (length <= 0) return [];

  const targetCount = Math.max(32, Math.min(96, Math.round(length / Math.max(3, diagonal * 0.025))));
  const resampled = normalizeCornerLoop(resamplePolyline(points, targetCount));
  if (resampled.length < 9) return [];

  const window = 3;
  const straws: number[] = [];
  for (let i = window; i < resampled.length - window; i += 1) {
    straws[i] = distance(resampled[i - window], resampled[i + window]);
  }

  const strawValues = straws.filter((value): value is number => typeof value === "number");
  const threshold = getMedian(strawValues) * 0.95;
  const candidates: StrokePoint[] = [];

  for (let i = window; i < resampled.length - window; i += 1) {
    const current = straws[i];
    if (current === undefined || current > threshold) continue;

    const prev = straws[i - 1] ?? Infinity;
    const next = straws[i + 1] ?? Infinity;
    if (current <= prev && current <= next) {
      candidates.push(resampled[i]);
    }
  }

  return mergeCyclicNearbyPoints(candidates, Math.max(5, diagonal * 0.055));
};

const mergeCornerCandidateSets = (
  candidateSets: StrokePoint[][],
  diagonal: number
): StrokePoint[] => {
  const merged: StrokePoint[] = [];
  const threshold = Math.max(5, diagonal * 0.05);

  for (const candidates of candidateSets) {
    for (const candidate of candidates) {
      const existingIndex = merged.findIndex((point) => distance(point, candidate) <= threshold);
      if (existingIndex < 0) {
        merged.push(candidate);
      } else {
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          x: (existing.x + candidate.x) / 2,
          y: (existing.y + candidate.y) / 2,
          pressure: (existing.pressure + candidate.pressure) / 2,
        };
      }
    }
  }

  return mergeCyclicNearbyPoints(merged, threshold);
};

const extractBestLoopTrace = (
  points: StrokePoint[],
  diagonal: number
): { points: StrokePoint[]; closedness: number; traceReason: string } | null => {
  if (points.length < 6) return null;

  const totalPath = pathLength(points);
  if (totalPath <= 0) return null;

  const endpointClosedness = safeDivide(
    distance(points[0], points[points.length - 1]),
    totalPath
  );
  if (endpointClosedness <= MAX_SINGLE_CLOSEDNESS) {
    return {
      points,
      closedness: endpointClosedness,
      traceReason: "endpoints",
    };
  }

  const maxJoinGap = Math.max(10, diagonal * 0.22);
  const minSpan = Math.max(6, Math.floor(points.length * 0.55));
  let best: { start: number; end: number; score: number; closedness: number } | null =
    null;

  for (let start = 0; start < points.length - minSpan; start += 1) {
    for (let end = start + minSpan; end < points.length; end += 1) {
      const trace = points.slice(start, end + 1);
      const tracePath = pathLength(trace);
      if (tracePath < totalPath * 0.58) continue;

      const gap = distance(points[start], points[end]);
      if (gap > maxJoinGap) continue;

      const closedness = safeDivide(gap, tracePath);
      if (closedness > MAX_SINGLE_CLOSEDNESS) continue;

      const trimmedCount = start + (points.length - 1 - end);
      const score =
        safeDivide(tracePath, totalPath) -
        safeDivide(gap, maxJoinGap) * 0.3 -
        safeDivide(trimmedCount, points.length) * 0.2;

      if (!best || score > best.score) {
        best = { start, end, score, closedness };
      }
    }
  }

  if (!best) return null;

  return {
    points: points.slice(best.start, best.end + 1),
    closedness: best.closedness,
    traceReason: "trimmed-loop",
  };
};

const looksLikeAxisAlignedDiamond = (corners: StrokePoint[], bbox: BBox): boolean => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return false;

  const tolerance = 0.18;
  const hasLeft = corners.some(
    (point) =>
      Math.abs(point.x - bbox.minX) / width <= tolerance &&
      Math.abs(point.y - (bbox.minY + height / 2)) / height <= tolerance
  );
  const hasRight = corners.some(
    (point) =>
      Math.abs(point.x - bbox.maxX) / width <= tolerance &&
      Math.abs(point.y - (bbox.minY + height / 2)) / height <= tolerance
  );
  const hasTop = corners.some(
    (point) =>
      Math.abs(point.y - bbox.minY) / height <= tolerance &&
      Math.abs(point.x - (bbox.minX + width / 2)) / width <= tolerance
  );
  const hasBottom = corners.some(
    (point) =>
      Math.abs(point.y - bbox.maxY) / height <= tolerance &&
      Math.abs(point.x - (bbox.minX + width / 2)) / width <= tolerance
  );

  return hasLeft && hasRight && hasTop && hasBottom;
};

const evaluateRectangleGeometry = (
  mode: "single-stroke",
  cornersInput: StrokePoint[],
  closureOrGraphScore: number,
  rawCornerCount = cornersInput.length
): RectangleEval | null => {
  const corners = getOrderedCornersByAngle(cornersInput);
  if (corners.length !== 4) return null;

  const bbox = getPointsBBox(corners);
  if (!bbox) return null;

  const diagonal = getBBoxDiagonal(bbox);
  if (diagonal < MIN_BBOX_DIAGONAL) return null;
  if (looksLikeAxisAlignedDiamond(corners, bbox)) return null;

  const ring = closeCornerRing(corners);
  const sideLengths: number[] = [];
  const edgeAngles: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    sideLengths.push(distance(ring[i], ring[i + 1]));
    edgeAngles.push(Math.atan2(ring[i + 1].y - ring[i].y, ring[i + 1].x - ring[i].x));
  }

  const perimeter = sideLengths.reduce((sum, value) => sum + value, 0);
  if (perimeter <= 0) return null;

  const minSide = Math.min(...sideLengths);
  const maxSide = Math.max(...sideLengths);
  if (minSide < perimeter * MIN_SIDE_PERIMETER_RATIO) return null;
  if (safeDivide(minSide, maxSide) < MIN_SIDE_TO_MAX_SIDE_RATIO) return null;

  const angleErrors: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const prev = ring[(i + 3) % 4];
    const curr = ring[i];
    const next = ring[(i + 1) % 4];
    const insideAngle = Math.PI - angleBetweenSegments(prev, curr, curr, next);
    const errorDeg = Math.abs(toDeg(insideAngle) - 90);
    angleErrors.push(errorDeg);
  }

  if (angleErrors.some((error) => error > MAX_RIGHT_ANGLE_ERROR_DEG)) return null;

  const parallelErrors = [
    getParallelErrorDeg(edgeAngles[0], edgeAngles[2]),
    getParallelErrorDeg(edgeAngles[1], edgeAngles[3]),
  ];

  if (parallelErrors.some((error) => error > MAX_PARALLEL_ERROR_DEG)) return null;

  const cornerScore = 1 - clamp01(Math.max(0, rawCornerCount - 4) / 5);
  const angleScore = 1 - clamp01(Math.max(...angleErrors) / MAX_RIGHT_ANGLE_ERROR_DEG);
  const parallelScore =
    1 - clamp01(Math.max(...parallelErrors) / MAX_PARALLEL_ERROR_DEG);
  const sideLengthScore = clamp01(
    safeDivide(minSide, perimeter * MIN_SIDE_PERIMETER_RATIO * 1.9)
  );

  const axisSnap = getAxisSnapRotation(edgeAngles[0]);
  const rotation = axisSnap.rotation;
  const rotationReliable = angleScore >= 0.6 && parallelScore >= 0.6;

  const confidence = clamp01(
    closureOrGraphScore * 0.2 +
      cornerScore * 0.2 +
      angleScore * 0.25 +
      parallelScore * 0.2 +
      sideLengthScore * 0.15
  );

  return {
    mode,
    corners,
    closureOrGraphScore,
    cornerScore,
    rawCornerCount,
    angleScore,
    parallelScore,
    sideLengthScore,
    confidence,
    angleErrors,
    parallelErrors,
    rotation,
    rotationReliable,
    rotationReason: !rotationReliable
      ? "rotation-unreliable-fallback-to-bbox"
      : axisSnap.snapped
        ? "rotation-snapped-to-axis"
        : undefined,
    snappedToAxis: axisSnap.snapped,
    bbox,
  };
};

const findBestRectangleEval = (
  points: StrokePoint[],
  diagonal: number,
  closureScore: number
): RectangleEval | null => {
  const toleranceRatios = [0.018, 0.026, 0.036, 0.052, 0.072];
  let best: RectangleEval | null = null;
  const strawCandidates = extractShortStrawCandidates(points, diagonal);

  for (const ratio of toleranceRatios) {
    const tolerance = Math.max(2, diagonal * ratio);
    const rdpCandidates = extractCornerCandidates(points, diagonal, tolerance);
    const candidateSets = [
      rdpCandidates,
      strawCandidates,
      mergeCornerCandidateSets([rdpCandidates, strawCandidates], diagonal),
    ];

    for (const candidates of candidateSets) {
      if (
        candidates.length < 4 ||
        candidates.length > MAX_DOMINANT_CORNER_CANDIDATES
      ) {
        continue;
      }

      for (const corners of getCombinationsOfFour(candidates)) {
        const evaluation = evaluateRectangleGeometry(
          "single-stroke",
          corners,
          closureScore,
          candidates.length
        );
        if (!evaluation) continue;
        if (!best || evaluation.confidence > best.confidence) {
          best = evaluation;
        }
      }
    }
  }

  return best;
};

const SIDE_ORDER: BBoxSide[] = ["top", "right", "bottom", "left"];

const getSideIndex = (side: BBoxSide): number => SIDE_ORDER.indexOf(side);

const getSideTransitionScore = (sideSequence: BBoxSide[]): number => {
  if (sideSequence.length < 4) return 0;

  const uniqueSides = new Set(sideSequence);
  if (uniqueSides.size < 4) return 0;

  let adjacentTransitions = 0;
  let oppositeTransitions = 0;

  for (let i = 1; i < sideSequence.length; i += 1) {
    const prev = getSideIndex(sideSequence[i - 1]);
    const curr = getSideIndex(sideSequence[i]);
    const diff = Math.abs(prev - curr);
    const circularDiff = Math.min(diff, SIDE_ORDER.length - diff);

    if (circularDiff === 1) adjacentTransitions += 1;
    if (circularDiff === 2) oppositeTransitions += 1;
  }

  return clamp01(
    safeDivide(adjacentTransitions, Math.max(3, sideSequence.length - 1)) -
      oppositeTransitions * 0.18
  );
};

const assignPointToBBoxSide = (
  point: StrokePoint,
  bbox: BBox
): { side: BBoxSide; projection: number } | null => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return null;

  const candidates: Array<{ side: BBoxSide; distance: number; projection: number }> = [
    {
      side: "top",
      distance: safeDivide(point.y - bbox.minY, height, 1),
      projection: clamp01(safeDivide(point.x - bbox.minX, width)),
    },
    {
      side: "right",
      distance: safeDivide(bbox.maxX - point.x, width, 1),
      projection: clamp01(safeDivide(point.y - bbox.minY, height)),
    },
    {
      side: "bottom",
      distance: safeDivide(bbox.maxY - point.y, height, 1),
      projection: clamp01(safeDivide(point.x - bbox.minX, width)),
    },
    {
      side: "left",
      distance: safeDivide(point.x - bbox.minX, width, 1),
      projection: clamp01(safeDivide(point.y - bbox.minY, height)),
    },
  ];

  const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > AXIS_SIDE_BAND) return null;
  return { side: nearest.side, projection: nearest.projection };
};

const evaluateAxisBoxEvidence = (
  points: StrokePoint[],
  bbox: BBox,
  closureScore: number
): RectangleEval | null => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return null;

  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  if (safeDivide(minSide, maxSide) < MIN_SIDE_TO_MAX_SIDE_RATIO) return null;

  const perimeter = (width + height) * 2;
  const strokePathLength = pathLength(points);
  const pathRatio = safeDivide(strokePathLength, perimeter);
  if (pathRatio < 0.56 || pathRatio > 1.9) return null;

  let signedArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    signedArea += current.x * next.y - next.x * current.y;
  }

  const areaRatio = safeDivide(Math.abs(signedArea) / 2, width * height);
  if (areaRatio < MIN_AXIS_AREA_RATIO) return null;

  const sampleCount = Math.max(36, Math.min(96, Math.round(strokePathLength / 5)));
  const samples = resamplePolyline(points, sampleCount);
  const bboxCorners = getAxisAlignedBBoxCorners(bbox);
  const cornerDistances = bboxCorners.map((corner) =>
    Math.min(
      ...samples.map((sample) =>
        Math.hypot(
          safeDivide(sample.x - corner.x, width),
          safeDivide(sample.y - corner.y, height)
        )
      )
    )
  );
  const cornerContactAvgDistance = safeDivide(
    cornerDistances.reduce((sum, value) => sum + value, 0),
    cornerDistances.length
  );
  const cornerContactScore =
    1 -
    clamp01(
      safeDivide(
        cornerContactAvgDistance - CORNER_CONTACT_GOOD,
        CORNER_CONTACT_POOR - CORNER_CONTACT_GOOD
      )
    );

  const projections: Record<BBoxSide, number[]> = {
    top: [],
    right: [],
    bottom: [],
    left: [],
  };
  const sideSequence: BBoxSide[] = [];

  for (const sample of samples) {
    const assigned = assignPointToBBoxSide(sample, bbox);
    if (!assigned) continue;

    projections[assigned.side].push(assigned.projection);
    if (sideSequence[sideSequence.length - 1] !== assigned.side) {
      sideSequence.push(assigned.side);
    }
  }

  if (sideSequence.length > 1 && sideSequence[0] === sideSequence[sideSequence.length - 1]) {
    sideSequence.pop();
  }

  const sideCoverages = SIDE_ORDER.reduce(
    (acc, side) => {
      const values = projections[side];
      if (values.length < 2) {
        acc[side] = 0;
      } else {
        acc[side] = Math.max(...values) - Math.min(...values);
      }
      return acc;
    },
    { top: 0, right: 0, bottom: 0, left: 0 } as Record<BBoxSide, number>
  );

  const coverageValues = SIDE_ORDER.map((side) => sideCoverages[side]);
  const minCoverage = Math.min(...coverageValues);
  if (minCoverage < MIN_AXIS_SIDE_COVERAGE) return null;

  const avgCoverage = safeDivide(
    coverageValues.reduce((sum, value) => sum + value, 0),
    coverageValues.length
  );
  const transitionScore = getSideTransitionScore(sideSequence);
  if (transitionScore < 0.45) return null;

  const coverageScore = clamp01(avgCoverage / 0.78);
  const minCoverageScore = clamp01(minCoverage / 0.52);
  const pathRatioScore = 1 - clamp01(Math.abs(pathRatio - 1) / 0.75);
  const areaScore = clamp01(areaRatio / 0.82);

  const axisBoxScore = clamp01(
    coverageScore * 0.22 +
      minCoverageScore * 0.15 +
      transitionScore * 0.18 +
      pathRatioScore * 0.08 +
      areaScore * 0.1 +
      closureScore * 0.07 +
      cornerContactScore * 0.2
  );
  if (axisBoxScore < 0.8) return null;

  const evaluation = evaluateRectangleGeometry(
    "single-stroke",
    getAxisAlignedBBoxCorners(bbox),
    closureScore,
    4
  );
  if (!evaluation) return null;

  return {
    ...evaluation,
    confidence: axisBoxScore,
    rotation: 0,
    rotationReliable: true,
    rotationReason: "axis-box-evidence",
    snappedToAxis: true,
    axisBoxScore,
    sideCoverages,
    areaRatio,
    cornerContactScore,
    cornerContactAvgDistance,
  };
};

const buildRectangleReplacementStroke = (
  source: Stroke,
  evalResult: RectangleEval
): Stroke => {
  const { bbox } = evalResult;

  return {
    id: createStrokeId(),
    tool: Tool.Rectangle,
    points: [
      { x: bbox.minX, y: bbox.minY, pressure: source.points[0]?.pressure ?? 1 },
      { x: bbox.maxX, y: bbox.maxY, pressure: source.points[0]?.pressure ?? 1 },
    ],
    color: source.color,
    thickness: source.thickness,
    drawableSeed: source.drawableSeed,
    shapeFill: source.shapeFill,
  };
};

export const rectangleRecognizer: ShapeRecognizer = {
  kind: "rectangle",
  detect: (metrics, context) => {
    if (metrics.strokeCount !== 1) return null;

    const source = context.sourceStrokes[0];
    if (!source) return null;

    let evalResult: RectangleEval | null = null;
    let closednessDebug = 1;
    let traceReasonDebug = "none";

    if (metrics.strokeCount === 1) {
      const stroke = context.sourceStrokes[0];
      if (!stroke || stroke.points.length < 6) return null;

      const bbox = getPointsBBox(stroke.points);
      if (!bbox) return null;
      const diagonal = getBBoxDiagonal(bbox);
      if (diagonal < MIN_BBOX_DIAGONAL) return null;

      const trace = extractBestLoopTrace(stroke.points, diagonal);
      const fallbackClosedness = safeDivide(
        distance(stroke.points[0], stroke.points[stroke.points.length - 1]),
        Math.max(1, pathLength(stroke.points))
      );
      const activeClosedness = trace?.closedness ?? fallbackClosedness;
      const closureScore = 1 - clamp01(safeDivide(activeClosedness, 0.34));

      closednessDebug = activeClosedness;
      traceReasonDebug = trace?.traceReason ?? "axis-box-open";

      const cornerEval = trace
        ? findBestRectangleEval(trace.points, diagonal, closureScore)
        : null;
      const axisBoxEval = evaluateAxisBoxEvidence(
        trace?.points ?? stroke.points,
        bbox,
        closureScore
      );

      if (cornerEval && axisBoxEval) {
        evalResult =
          axisBoxEval.confidence >= cornerEval.confidence - 0.04
            ? axisBoxEval
            : cornerEval;
      } else {
        evalResult = cornerEval ?? axisBoxEval;
      }
    }

    if (!evalResult) return null;

    const replacement = buildRectangleReplacementStroke(source, evalResult);

    return {
      kind: "rectangle",
      confidence: evalResult.confidence,
      sourceStrokeIds: context.sourceStrokes.map((stroke) => stroke.id),
      replacementStrokes: [replacement],
      reasons: [
        `mode:${evalResult.mode}`,
        `closureOrGraph:${evalResult.closureOrGraphScore.toFixed(3)}`,
        `corner:${evalResult.cornerScore.toFixed(3)}`,
        `angle:${evalResult.angleScore.toFixed(3)}`,
        `parallel:${evalResult.parallelScore.toFixed(3)}`,
        `side:${evalResult.sideLengthScore.toFixed(3)}`,
        `trace:${traceReasonDebug}`,
        ...(evalResult.rotationReason ? [evalResult.rotationReason] : []),
      ],
      debugGeometry: {
        mode: evalResult.mode,
        closedness: closednessDebug,
        traceReason: traceReasonDebug,
        cornerCount: evalResult.corners.length,
        rawCornerCount: evalResult.rawCornerCount,
        angleErrors: evalResult.angleErrors,
        parallelErrors: evalResult.parallelErrors,
        rotation: evalResult.rotation,
        rotationReliable: evalResult.rotationReliable,
        snappedToAxis: evalResult.snappedToAxis,
        axisBoxScore: evalResult.axisBoxScore,
        sideCoverages: evalResult.sideCoverages,
        areaRatio: evalResult.areaRatio,
        cornerContactScore: evalResult.cornerContactScore,
        cornerContactAvgDistance: evalResult.cornerContactAvgDistance,
      },
    } as ShapeDetectionCandidate;
  },
};

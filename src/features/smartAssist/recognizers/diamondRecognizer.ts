import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, StrokePoint, Tool } from "@/types";
import { ShapeRecognizer } from "../types";
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

const MAX_CLOSEDNESS = 0.28;
const MAX_OPEN_CLOSEDNESS = 0.46;
const MIN_BBOX_DIAGONAL = 32;
const MAX_ANGLE_ERROR_DEG = 42;
const MAX_PARALLEL_ERROR_DEG = 34;
const MIN_SIDE_TO_MAX_SIDE_RATIO = 0.2;
const MAX_CANDIDATES = 8;
const DIAMOND_SIDE_BAND = 0.2;
const MIN_DIAMOND_SIDE_COVERAGE = 0.34;
const MIN_DIAMOND_AREA_RATIO = 0.26;
const MAX_DIAMOND_AREA_RATIO = 0.6;

type BBox = NonNullable<ReturnType<typeof getPointsBBox>>;

interface DiamondEval {
  corners: StrokePoint[];
  rawCornerCount: number;
  confidence: number;
  closureScore: number;
  midpointScore: number;
  angleScore: number;
  parallelScore: number;
  sideScore: number;
  angleErrors: number[];
  parallelErrors: number[];
  diamondAxisScore?: number;
  edgeCoverages?: Record<DiamondEdge, number>;
  areaRatio?: number;
  vertexContactScore?: number;
  bbox: BBox;
}

type DiamondEdge = "topRight" | "bottomRight" | "bottomLeft" | "topLeft";

const toDeg = (radians: number): number => (radians * 180) / Math.PI;

const normalizeLoop = (points: StrokePoint[]): StrokePoint[] => {
  if (points.length < 2) return [...points];
  const loop = [...points];
  if (distance(loop[0], loop[loop.length - 1]) <= 1e-6) loop.pop();
  return loop;
};

const orderByAngle = (points: StrokePoint[]): StrokePoint[] => {
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

const mergeCyclicNearbyPoints = (
  points: StrokePoint[],
  thresholdPx: number
): StrokePoint[] => {
  const merged = normalizeLoop(mergeNearbyPoints(points, thresholdPx));
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

const getDiamondVertices = (bbox: BBox): StrokePoint[] => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  return [
    { x: bbox.minX + width / 2, y: bbox.minY, pressure: 1 },
    { x: bbox.maxX, y: bbox.minY + height / 2, pressure: 1 },
    { x: bbox.minX + width / 2, y: bbox.maxY, pressure: 1 },
    { x: bbox.minX, y: bbox.minY + height / 2, pressure: 1 },
  ];
};

const getLoopAreaRatio = (points: StrokePoint[], bbox: BBox): number => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0 || points.length < 3) return 0;

  let signedArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    signedArea += current.x * next.y - next.x * current.y;
  }

  return safeDivide(Math.abs(signedArea) / 2, width * height);
};

const isDiamondLikeAreaRatio = (areaRatio: number): boolean =>
  areaRatio >= MIN_DIAMOND_AREA_RATIO && areaRatio <= MAX_DIAMOND_AREA_RATIO;

const getPathRatio = (points: StrokePoint[], bbox: BBox): number => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const expectedPerimeter = 4 * Math.hypot(width / 2, height / 2);
  return safeDivide(pathLength(points), expectedPerimeter);
};

const extractCandidates = (
  points: StrokePoint[],
  diagonal: number,
  tolerance: number
): StrokePoint[] => {
  const simplified = normalizeLoop(simplifyStroke(points, tolerance, true));
  const extracted = extractCornersFromSimplifiedStroke(simplified, {
    minAngleRadians: Math.PI / 6,
    minPointSpacing: Math.max(3, diagonal * 0.045),
  });
  return mergeCyclicNearbyPoints(extracted, Math.max(5, diagonal * 0.055));
};

const parallelErrorDeg = (a: number, b: number): number => {
  const deltaDeg = Math.abs(toDeg(signedAngleDelta(a, b)));
  return Math.abs(deltaDeg - 180);
};

const getDiamondMidpointScore = (corners: StrokePoint[], bbox: BBox): number => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return 0;

  const targets = [
    { x: bbox.minX + width / 2, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY + height / 2 },
    { x: bbox.minX + width / 2, y: bbox.maxY },
    { x: bbox.minX, y: bbox.minY + height / 2 },
  ];

  const avgDistance = safeDivide(
    targets.reduce((sum, target) => {
      const nearest = Math.min(
        ...corners.map((corner) =>
          Math.hypot(
            safeDivide(corner.x - target.x, width),
            safeDivide(corner.y - target.y, height)
          )
        )
      );
      return sum + nearest;
    }, 0),
    targets.length
  );

  return 1 - clamp01(safeDivide(avgDistance - 0.06, 0.2));
};

const evaluateDiamond = (
  cornersInput: StrokePoint[],
  closureScore: number,
  rawCornerCount: number
): DiamondEval | null => {
  const corners = orderByAngle(cornersInput);
  const bbox = getPointsBBox(corners);
  if (!bbox) return null;

  const diagonal = getBBoxDiagonal(bbox);
  if (diagonal < MIN_BBOX_DIAGONAL) return null;

  const ring = [...corners, corners[0]];
  const sideLengths: number[] = [];
  const edgeAngles: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    sideLengths.push(distance(ring[i], ring[i + 1]));
    edgeAngles.push(Math.atan2(ring[i + 1].y - ring[i].y, ring[i + 1].x - ring[i].x));
  }

  const minSide = Math.min(...sideLengths);
  const maxSide = Math.max(...sideLengths);
  if (safeDivide(minSide, maxSide) < MIN_SIDE_TO_MAX_SIDE_RATIO) return null;

  const angleErrors: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const prev = ring[(i + 3) % 4];
    const curr = ring[i];
    const next = ring[(i + 1) % 4];
    const insideAngle = Math.PI - angleBetweenSegments(prev, curr, curr, next);
    const acuteOrRightError = Math.max(0, Math.abs(toDeg(insideAngle) - 90) - 28);
    angleErrors.push(acuteOrRightError);
  }
  if (angleErrors.some((error) => error > MAX_ANGLE_ERROR_DEG)) return null;

  const parallelErrors = [
    parallelErrorDeg(edgeAngles[0], edgeAngles[2]),
    parallelErrorDeg(edgeAngles[1], edgeAngles[3]),
  ];
  if (parallelErrors.some((error) => error > MAX_PARALLEL_ERROR_DEG)) return null;

  const midpointScore = getDiamondMidpointScore(corners, bbox);
  if (midpointScore < 0.45) return null;

  const angleScore = 1 - clamp01(Math.max(...angleErrors) / MAX_ANGLE_ERROR_DEG);
  const parallelScore =
    1 - clamp01(Math.max(...parallelErrors) / MAX_PARALLEL_ERROR_DEG);
  const sideScore = clamp01(safeDivide(minSide, maxSide * 0.48));
  const cornerScore = 1 - clamp01(Math.max(0, rawCornerCount - 4) / 5);

  const confidence = clamp01(
    midpointScore * 0.34 +
      closureScore * 0.16 +
      angleScore * 0.16 +
      parallelScore * 0.16 +
      sideScore * 0.1 +
      cornerScore * 0.08
  );

  return {
    corners,
    rawCornerCount,
    confidence,
    closureScore,
    midpointScore,
    angleScore,
    parallelScore,
    sideScore,
    angleErrors,
    parallelErrors,
    bbox,
  };
};

const findBestDiamond = (
  points: StrokePoint[],
  diagonal: number,
  closureScore: number
): DiamondEval | null => {
  const toleranceRatios = [0.018, 0.028, 0.042, 0.06, 0.08];
  let best: DiamondEval | null = null;

  for (const ratio of toleranceRatios) {
    const candidates = extractCandidates(points, diagonal, Math.max(2, diagonal * ratio));
    if (candidates.length < 4 || candidates.length > MAX_CANDIDATES) continue;

    for (const corners of getCombinationsOfFour(candidates)) {
      const evaluation = evaluateDiamond(corners, closureScore, candidates.length);
      if (!evaluation) continue;
      if (!best || evaluation.confidence > best.confidence) best = evaluation;
    }
  }

  return best;
};

const EDGE_ORDER: DiamondEdge[] = [
  "topRight",
  "bottomRight",
  "bottomLeft",
  "topLeft",
];

const getEdgeIndex = (edge: DiamondEdge): number => EDGE_ORDER.indexOf(edge);

const distanceToUnitSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
): { distance: number; projection: number } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      projection: 0,
    };
  }

  const projection = clamp01(
    safeDivide((point.x - start.x) * dx + (point.y - start.y) * dy, lengthSq)
  );
  const x = start.x + dx * projection;
  const y = start.y + dy * projection;
  return {
    distance: Math.hypot(point.x - x, point.y - y),
    projection,
  };
};

const assignPointToDiamondEdge = (
  point: StrokePoint,
  bbox: BBox
): { edge: DiamondEdge; projection: number } | null => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return null;

  const unitPoint = {
    x: safeDivide(point.x - bbox.minX, width),
    y: safeDivide(point.y - bbox.minY, height),
  };
  const vertices = [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0, y: 0.5 },
  ];

  const candidates = EDGE_ORDER.map((edge, index) => ({
    edge,
    ...distanceToUnitSegment(
      unitPoint,
      vertices[index],
      vertices[(index + 1) % vertices.length]
    ),
  })).sort((a, b) => a.distance - b.distance);

  const nearest = candidates[0];
  if (!nearest || nearest.distance > DIAMOND_SIDE_BAND) return null;
  return { edge: nearest.edge, projection: nearest.projection };
};

const getEdgeTransitionScore = (edgeSequence: DiamondEdge[]): number => {
  if (edgeSequence.length < 4) return 0;
  if (new Set(edgeSequence).size < 4) return 0;

  let adjacentTransitions = 0;
  let oppositeTransitions = 0;
  for (let i = 1; i < edgeSequence.length; i += 1) {
    const prev = getEdgeIndex(edgeSequence[i - 1]);
    const curr = getEdgeIndex(edgeSequence[i]);
    const diff = Math.abs(prev - curr);
    const circularDiff = Math.min(diff, EDGE_ORDER.length - diff);
    if (circularDiff === 1) adjacentTransitions += 1;
    if (circularDiff === 2) oppositeTransitions += 1;
  }

  return clamp01(
    safeDivide(adjacentTransitions, Math.max(3, edgeSequence.length - 1)) -
      oppositeTransitions * 0.18
  );
};

const evaluateDiamondAxisEvidence = (
  points: StrokePoint[],
  bbox: BBox,
  closureScore: number
): DiamondEval | null => {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return null;

  const areaRatio = getLoopAreaRatio(points, bbox);
  if (!isDiamondLikeAreaRatio(areaRatio)) {
    return null;
  }

  const strokePathLength = pathLength(points);
  const pathRatio = getPathRatio(points, bbox);
  if (pathRatio < 0.52 || pathRatio > 2.05) return null;

  const samples = resamplePolyline(
    points,
    Math.max(36, Math.min(96, Math.round(strokePathLength / 5)))
  );
  const edgeProjections: Record<DiamondEdge, number[]> = {
    topRight: [],
    bottomRight: [],
    bottomLeft: [],
    topLeft: [],
  };
  const edgeSequence: DiamondEdge[] = [];

  for (const sample of samples) {
    const assigned = assignPointToDiamondEdge(sample, bbox);
    if (!assigned) continue;

    edgeProjections[assigned.edge].push(assigned.projection);
    if (edgeSequence[edgeSequence.length - 1] !== assigned.edge) {
      edgeSequence.push(assigned.edge);
    }
  }

  if (edgeSequence.length > 1 && edgeSequence[0] === edgeSequence[edgeSequence.length - 1]) {
    edgeSequence.pop();
  }

  const edgeCoverages = EDGE_ORDER.reduce(
    (acc, edge) => {
      const values = edgeProjections[edge];
      acc[edge] = values.length < 2 ? 0 : Math.max(...values) - Math.min(...values);
      return acc;
    },
    {
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
      topLeft: 0,
    } as Record<DiamondEdge, number>
  );

  const coverageValues = EDGE_ORDER.map((edge) => edgeCoverages[edge]);
  const minCoverage = Math.min(...coverageValues);
  if (minCoverage < MIN_DIAMOND_SIDE_COVERAGE) return null;

  const avgCoverage = safeDivide(
    coverageValues.reduce((sum, value) => sum + value, 0),
    coverageValues.length
  );
  const transitionScore = getEdgeTransitionScore(edgeSequence);
  if (transitionScore < 0.45) return null;

  const vertices = getDiamondVertices(bbox);
  const vertexDistances = vertices.map((vertex) =>
    Math.min(
      ...samples.map((sample) =>
        Math.hypot(
          safeDivide(sample.x - vertex.x, width),
          safeDivide(sample.y - vertex.y, height)
        )
      )
    )
  );
  const avgVertexDistance = safeDivide(
    vertexDistances.reduce((sum, value) => sum + value, 0),
    vertexDistances.length
  );
  const vertexContactScore = 1 - clamp01(safeDivide(avgVertexDistance - 0.08, 0.2));

  const coverageScore = clamp01(avgCoverage / 0.76);
  const minCoverageScore = clamp01(minCoverage / 0.5);
  const areaScore = 1 - clamp01(Math.abs(areaRatio - 0.5) / 0.28);
  const pathRatioScore = 1 - clamp01(Math.abs(pathRatio - 1) / 0.85);
  const diamondAxisScore = clamp01(
    coverageScore * 0.25 +
      minCoverageScore * 0.17 +
      transitionScore * 0.17 +
      areaScore * 0.17 +
      vertexContactScore * 0.16 +
      pathRatioScore * 0.08
  );
  if (diamondAxisScore < 0.8) return null;

  const geometry = evaluateDiamond(getDiamondVertices(bbox), closureScore, 4);
  if (!geometry) return null;

  return {
    ...geometry,
    confidence: diamondAxisScore,
    diamondAxisScore,
    edgeCoverages,
    areaRatio,
    vertexContactScore,
  };
};

const buildDiamondReplacementStroke = (source: Stroke, bbox: BBox): Stroke => ({
  id: createStrokeId(),
  tool: Tool.Diamond,
  points: [
    { x: bbox.minX, y: bbox.minY, pressure: source.points[0]?.pressure ?? 1 },
    { x: bbox.maxX, y: bbox.maxY, pressure: source.points[0]?.pressure ?? 1 },
  ],
  color: source.color,
  thickness: source.thickness,
  drawableSeed: source.drawableSeed,
  shapeFill: source.shapeFill,
});

export const diamondRecognizer: ShapeRecognizer = {
  kind: "diamond",
  detect: (metrics, context) => {
    if (metrics.strokeCount !== 1) return null;

    const stroke = context.sourceStrokes[0];
    if (!stroke || stroke.points.length < 6) return null;

    const bbox = getPointsBBox(stroke.points);
    if (!bbox) return null;

    const diagonal = getBBoxDiagonal(bbox);
    if (diagonal < MIN_BBOX_DIAGONAL) return null;

    const strokePathLength = Math.max(1, pathLength(stroke.points));
    const closedness = safeDivide(
      distance(stroke.points[0], stroke.points[stroke.points.length - 1]),
      strokePathLength
    );
    const closureScore = 1 - clamp01(safeDivide(closedness, MAX_OPEN_CLOSEDNESS));
    const areaRatio = getLoopAreaRatio(stroke.points, bbox);
    const pathRatio = getPathRatio(stroke.points, bbox);
    const cornerEval =
      closedness <= MAX_CLOSEDNESS &&
      isDiamondLikeAreaRatio(areaRatio) &&
      pathRatio >= 0.52 &&
      pathRatio <= 2.05
        ? findBestDiamond(stroke.points, diagonal, closureScore)
        : null;
    const axisEval = closedness <= MAX_OPEN_CLOSEDNESS
      ? evaluateDiamondAxisEvidence(stroke.points, bbox, closureScore)
      : null;
    const evaluation =
      cornerEval && axisEval
        ? axisEval.confidence >= cornerEval.confidence - 0.04
          ? axisEval
          : cornerEval
        : cornerEval ?? axisEval;
    if (!evaluation) return null;

    return {
      kind: "diamond",
      confidence: evaluation.confidence,
      sourceStrokeIds: [stroke.id],
      replacementStrokes: [buildDiamondReplacementStroke(stroke, evaluation.bbox)],
      reasons: [
        `closure:${evaluation.closureScore.toFixed(3)}`,
        `midpoint:${evaluation.midpointScore.toFixed(3)}`,
        `angle:${evaluation.angleScore.toFixed(3)}`,
        `parallel:${evaluation.parallelScore.toFixed(3)}`,
        `side:${evaluation.sideScore.toFixed(3)}`,
      ],
      debugGeometry: {
        mode: "single-stroke",
        closedness,
        cornerCount: evaluation.corners.length,
        rawCornerCount: evaluation.rawCornerCount,
        midpointScore: evaluation.midpointScore,
        diamondAxisScore: evaluation.diamondAxisScore,
        edgeCoverages: evaluation.edgeCoverages,
        areaRatio: evaluation.areaRatio ?? areaRatio,
        pathRatio,
        vertexContactScore: evaluation.vertexContactScore,
        angleErrors: evaluation.angleErrors,
        parallelErrors: evaluation.parallelErrors,
      },
    };
  },
};

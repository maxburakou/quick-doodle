import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { Stroke, StrokePoint, Tool } from "@/types";
import { ShapeRecognizer, SmartAssistShapeKind } from "../types";
import {
  angleBetweenSegments,
  clamp01,
  distance,
  getBBoxDiagonal,
  getPointsBBox,
  pathLength,
  resamplePolyline,
  safeDivide,
  simplifyStroke,
} from "../utils";

const SAMPLE_COUNT = 64;
const CLOUD_MATCH_EPSILON = 0.5;
const MIN_BBOX_DIAGONAL = 28;
const MIN_TEMPLATE_CONFIDENCE = 0.84;
const MIN_TEMPLATE_CONFIDENCE_MARGIN = 0.035;
const MIN_AMBIGUOUS_TEMPLATE_CONFIDENCE = 0.96;
const MIN_MULTI_STROKE_BOX_CONFIDENCE = 0.9;
const MIN_ARROW_CHORD_TO_PATH_RATIO = 0.28;
const MAX_ARROW_CHORD_TO_PATH_RATIO = 0.92;
const MAX_ELLIPSE_CHORD_TO_PATH_RATIO = 0.38;
const MAX_BOX_CHORD_TO_PATH_RATIO = 0.28;
const MAX_CLOSED_TEMPLATE_PATH_TO_DIAGONAL_RATIO = 4.4;
const MAX_ARROW_TEMPLATE_PATH_TO_DIAGONAL_RATIO = 3.4;
const MAX_FULL_ELLIPSE_TEMPLATE_PATH_TO_DIAGONAL_RATIO = 4.8;
const MAX_TEMPLATE_TURN_DENSITY = 0.26;
const MAX_TEMPLATE_SHARP_TURN_RATIO = 0.34;
const MAX_MULTI_STROKE_JOIN_RATIO = 0.18;
const MAX_LOOP_JOIN_RATIO = 0.16;
const MIN_LOOP_INDEX_SPAN_RATIO = 0.45;
const MIN_LOOP_PATH_TO_DIAGONAL_RATIO = 1.45;
const MAX_MULTI_STROKE_POLYGON_CLOSEDNESS = 0.28;
const MAX_MULTI_STROKE_POLYGON_SIMPLIFIED_POINTS = 7;
const MAX_MULTI_STROKE_SEGMENT_SIMPLIFIED_POINTS = 4;
const MIN_MULTI_STROKE_POLYGON_TURNS = 3;
const MIN_RECTANGLE_INTENT_SIDES = 3;
const MIN_RECTANGLE_INTENT_SIDE_COVERAGE = 0.42;
const MIN_RECTANGLE_INTENT_STRAIGHTNESS = 0.78;
const MAX_RECTANGLE_INTENT_SIDE_DISTANCE_RATIO = 0.26;

type TemplateKind = Extract<
  SmartAssistShapeKind,
  "arrow" | "rectangle" | "diamond" | "ellipse"
>;

interface NormalizedPoint {
  x: number;
  y: number;
  pressure: number;
}

interface ShapeTemplate {
  kind: TemplateKind;
  name: string;
  points: NormalizedPoint[];
}

interface TemplateMatch {
  template: ShapeTemplate;
  confidence: number;
  confidenceMargin: number;
  distance: number;
  secondBestConfidence: number;
  sourcePoints: StrokePoint[];
  source: "full" | "loop";
}

interface TemplateGestureQuality {
  pathToDiagonalRatio: number;
  turnDensity: number;
  sharpTurnRatio: number;
}

interface MultiStrokeRectangleIntent {
  confidence: number;
  sideCount: number;
  sideCoverages: Record<"top" | "right" | "bottom" | "left", number>;
  sideDistances: Record<"top" | "right" | "bottom" | "left", number>;
}

const point = (x: number, y: number): StrokePoint => ({ x, y, pressure: 0.5 });

const buildPolyline = (
  vertices: Array<[number, number]>,
  close = false
): StrokePoint[] => {
  const points = vertices.map(([x, y]) => point(x, y));
  return close ? [...points, points[0]] : points;
};

const buildEllipsePoints = (): StrokePoint[] =>
  Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / SAMPLE_COUNT;
    return point(Math.cos(angle), Math.sin(angle));
  });

const rotatePoints = (points: StrokePoint[], radians: number): StrokePoint[] => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((current) =>
    point(current.x * cos - current.y * sin, current.x * sin + current.y * cos)
  );
};

const getCentroid = (points: NormalizedPoint[]): NormalizedPoint => {
  const total = points.reduce(
    (acc, current) => ({ x: acc.x + current.x, y: acc.y + current.y }),
    { x: 0, y: 0 }
  );
  return {
    x: safeDivide(total.x, points.length),
    y: safeDivide(total.y, points.length),
    pressure: 0.5,
  };
};

const normalizePointCloud = (points: StrokePoint[]): NormalizedPoint[] => {
  const sampled = resamplePolyline(points, SAMPLE_COUNT);
  const bbox = getPointsBBox(sampled);
  if (!bbox) return [];

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const scale = Math.max(width, height, 1e-3);
  const normalized = sampled.map((current) => ({
    x: safeDivide(current.x - bbox.minX, scale),
    y: safeDivide(current.y - bbox.minY, scale),
    pressure: current.pressure,
  }));
  const centroid = getCentroid(normalized);

  return normalized.map((current) => ({
    x: current.x - centroid.x,
    y: current.y - centroid.y,
    pressure: current.pressure,
  }));
};

const makeTemplate = (
  kind: TemplateKind,
  name: string,
  points: StrokePoint[]
): ShapeTemplate => ({
  kind,
  name,
  points: normalizePointCloud(points),
});

const baseArrow = buildPolyline([
  [-1, 0],
  [0.62, 0],
  [0.28, -0.28],
  [0.62, 0],
  [0.28, 0.28],
]);

const SHAPE_TEMPLATES: ShapeTemplate[] = [
  makeTemplate("ellipse", "ellipse", buildEllipsePoints()),
  makeTemplate(
    "rectangle",
    "rectangle",
    buildPolyline(
      [
        [-1, -0.7],
        [1, -0.7],
        [1, 0.7],
        [-1, 0.7],
      ],
      true
    )
  ),
  makeTemplate(
    "diamond",
    "diamond",
    buildPolyline(
      [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
      true
    )
  ),
  ...Array.from({ length: 8 }, (_, index) =>
    makeTemplate(
      "arrow",
      `arrow-${index}`,
      rotatePoints(baseArrow, (Math.PI * 2 * index) / 8)
    )
  ),
];

const cloudDistance = (
  points: NormalizedPoint[],
  template: NormalizedPoint[],
  startIndex: number
): number => {
  const matched = new Array<boolean>(points.length).fill(false);
  let sum = 0;
  let index = startIndex;

  do {
    let bestDistance = Infinity;
    let bestIndex = -1;

    for (let i = 0; i < template.length; i += 1) {
      if (matched[i]) continue;
      const currentDistance = distance(points[index], template[i]);
      if (currentDistance < bestDistance) {
        bestDistance = currentDistance;
        bestIndex = i;
      }
    }

    matched[bestIndex] = true;
    const weight =
      1 - ((index - startIndex + points.length) % points.length) / points.length;
    sum += weight * bestDistance;
    index = (index + 1) % points.length;
  } while (index !== startIndex);

  return sum;
};

const greedyCloudMatch = (
  points: NormalizedPoint[],
  template: NormalizedPoint[]
): number => {
  const step = Math.max(
    1,
    Math.floor(points.length ** (1 - CLOUD_MATCH_EPSILON))
  );
  let minDistance = Infinity;

  for (let index = 0; index < points.length; index += step) {
    minDistance = Math.min(
      minDistance,
      cloudDistance(points, template, index),
      cloudDistance(template, points, index)
    );
  }

  return safeDivide(minDistance, points.length);
};

const getBestTemplateMatch = (
  points: StrokePoint[],
  includeLoopCandidate: boolean,
  preferFullPolygon: boolean
): TemplateMatch | null => {
  const candidateSets: Array<{ points: StrokePoint[]; source: "full" | "loop" }> = [
    { points, source: "full" },
  ];
  const loopPoints = includeLoopCandidate ? extractBestLoopPoints(points) : null;
  if (loopPoints) {
    candidateSets.push({ points: loopPoints, source: "loop" });
  }

  const matches = candidateSets.flatMap((candidateSet) => {
    const normalized = normalizePointCloud(candidateSet.points);
    if (normalized.length !== SAMPLE_COUNT) return [];

    return SHAPE_TEMPLATES.map((template) => {
      const matchDistance = greedyCloudMatch(normalized, template.points);
      return {
        template,
        distance: matchDistance,
        confidence: 1 - clamp01(safeDivide(matchDistance - 0.04, 0.34)),
        sourcePoints: candidateSet.points,
        source: candidateSet.source,
      };
    });
  });

  const withConfidenceMargin = (
    match: Omit<TemplateMatch, "confidenceMargin" | "secondBestConfidence">
  ): TemplateMatch => {
    const secondBestConfidence =
      matches
        .filter(
          (candidate) =>
            candidate.source === match.source &&
            candidate.template.kind !== match.template.kind
        )
        .sort((a, b) => b.confidence - a.confidence)[0]?.confidence ?? 0;

    return {
      ...match,
      secondBestConfidence,
      confidenceMargin: match.confidence - secondBestConfidence,
    };
  };

  const fullBest = matches
    .filter((match) => match.source === "full")
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (
    preferFullPolygon &&
    fullBest &&
    (fullBest.template.kind === "rectangle" || fullBest.template.kind === "diamond") &&
    fullBest.confidence >= MIN_MULTI_STROKE_BOX_CONFIDENCE
  ) {
    return withConfidenceMargin(fullBest);
  }
  if (
    fullBest &&
    (fullBest.template.kind === "rectangle" || fullBest.template.kind === "diamond") &&
    fullBest.confidence >= 0.995
  ) {
    return withConfidenceMargin(fullBest);
  }

  const loopEllipse = matches
    .filter((match) => match.source === "loop" && match.template.kind === "ellipse")
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (loopEllipse && loopEllipse.confidence >= 0.86) {
    return withConfidenceMargin(loopEllipse);
  }

  const best = matches.sort((a, b) => b.confidence - a.confidence)[0];
  return best ? withConfidenceMargin(best) : null;
};

const getTemplateGestureQuality = (
  points: StrokePoint[],
  diagonal: number
): TemplateGestureQuality => {
  const gesturePathLength = pathLength(points);
  const sampled = resamplePolyline(points, Math.min(64, Math.max(18, points.length)));
  let turnSum = 0;
  let sharpTurnCount = 0;

  for (let index = 1; index < sampled.length - 1; index += 1) {
    const prev = sampled[index - 1];
    const current = sampled[index];
    const next = sampled[index + 1];
    const turn = angleBetweenSegments(prev, current, current, next);
    turnSum += turn;
    if (turn >= Math.PI * 0.48) sharpTurnCount += 1;
  }

  const turnSlots = Math.max(1, sampled.length - 2);

  return {
    pathToDiagonalRatio: safeDivide(gesturePathLength, diagonal),
    turnDensity: safeDivide(turnSum, Math.PI * turnSlots),
    sharpTurnRatio: safeDivide(sharpTurnCount, turnSlots),
  };
};

const hasEnoughTemplateSeparation = (match: TemplateMatch): boolean =>
  match.confidence >= MIN_AMBIGUOUS_TEMPLATE_CONFIDENCE ||
  match.confidenceMargin >= MIN_TEMPLATE_CONFIDENCE_MARGIN;

const isTemplateGesturePlausible = (
  match: TemplateMatch,
  quality: TemplateGestureQuality,
  chordToPathRatio: number
): boolean => {
  if (!hasEnoughTemplateSeparation(match)) return false;

  if (
    quality.turnDensity > MAX_TEMPLATE_TURN_DENSITY ||
    quality.sharpTurnRatio > MAX_TEMPLATE_SHARP_TURN_RATIO
  ) {
    return false;
  }

  if (match.template.kind === "arrow") {
    return (
      chordToPathRatio >= MIN_ARROW_CHORD_TO_PATH_RATIO &&
      chordToPathRatio <= MAX_ARROW_CHORD_TO_PATH_RATIO &&
      quality.pathToDiagonalRatio <= MAX_ARROW_TEMPLATE_PATH_TO_DIAGONAL_RATIO
    );
  }

  if (match.template.kind === "ellipse") {
    return (
      chordToPathRatio <= MAX_ELLIPSE_CHORD_TO_PATH_RATIO &&
      (match.source === "loop" ||
        quality.pathToDiagonalRatio <=
          MAX_FULL_ELLIPSE_TEMPLATE_PATH_TO_DIAGONAL_RATIO)
    );
  }

  return (
    chordToPathRatio <= MAX_BOX_CHORD_TO_PATH_RATIO &&
    quality.pathToDiagonalRatio <= MAX_CLOSED_TEMPLATE_PATH_TO_DIAGONAL_RATIO
  );
};

const hasMultiStrokePolygonStructure = (
  strokes: Stroke[],
  points: StrokePoint[],
  diagonal: number
): boolean => {
  if (strokes.length <= 1) return false;

  const totalPathLength = Math.max(1, pathLength(points));
  const first = points[0];
  const last = points[points.length - 1] ?? first;
  const closedness = safeDivide(distance(first, last), totalPathLength);
  if (closedness > MAX_MULTI_STROKE_POLYGON_CLOSEDNESS) return false;

  const tolerance = Math.max(3, diagonal * 0.035);
  const simplified = simplifyStroke(points, tolerance, true);
  if (
    simplified.length < 4 ||
    simplified.length > MAX_MULTI_STROKE_POLYGON_SIMPLIFIED_POINTS
  ) {
    return false;
  }

  const strongTurns = simplified.reduce((count, current, index) => {
    if (index === 0 || index === simplified.length - 1) return count;
    const turn = angleBetweenSegments(
      simplified[index - 1],
      current,
      current,
      simplified[index + 1]
    );
    return turn >= Math.PI * 0.32 && turn <= Math.PI * 0.82
      ? count + 1
      : count;
  }, 0);
  if (strongTurns < MIN_MULTI_STROKE_POLYGON_TURNS) return false;

  return strokes.every((stroke) => {
    const strokePoints = stroke.points;
    if (strokePoints.length < 2) return false;
    return (
      simplifyStroke(strokePoints, tolerance, false).length <=
      MAX_MULTI_STROKE_SEGMENT_SIMPLIFIED_POINTS
    );
  });
};

const isMostlyStraightStroke = (
  stroke: Stroke,
  tolerance: number
): boolean => {
  const strokePathLength = pathLength(stroke.points);
  if (strokePathLength <= 0) return false;

  const straightness = safeDivide(
    distance(stroke.points[0], stroke.points[stroke.points.length - 1]),
    strokePathLength
  );
  if (straightness >= MIN_RECTANGLE_INTENT_STRAIGHTNESS) return true;

  return (
    simplifyStroke(stroke.points, tolerance, false).length <=
    MAX_MULTI_STROKE_SEGMENT_SIMPLIFIED_POINTS
  );
};

const getMultiStrokeRectangleIntent = (
  strokes: Stroke[],
  bbox: NonNullable<ReturnType<typeof getPointsBBox>>,
  diagonal: number
): MultiStrokeRectangleIntent | null => {
  if (strokes.length < 3) return null;

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 0 || height <= 0) return null;

  const tolerance = Math.max(3, diagonal * 0.035);
  const sideCoverages = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const sideDistances = {
    top: Infinity,
    right: Infinity,
    bottom: Infinity,
    left: Infinity,
  };

  for (const stroke of strokes) {
    if (stroke.points.length < 2 || !isMostlyStraightStroke(stroke, tolerance)) {
      continue;
    }

    const strokeBBox = getPointsBBox(stroke.points);
    if (!strokeBBox) continue;

    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const midX = (strokeBBox.minX + strokeBBox.maxX) / 2;
    const midY = (strokeBBox.minY + strokeBBox.maxY) / 2;
    const horizontal = Math.abs(dx) >= Math.abs(dy) * 1.35;
    const vertical = Math.abs(dy) >= Math.abs(dx) * 1.35;

    if (horizontal) {
      const coverage = clamp01(safeDivide(strokeBBox.maxX - strokeBBox.minX, width));
      if (coverage < MIN_RECTANGLE_INTENT_SIDE_COVERAGE) continue;

      const topDistance = safeDivide(Math.abs(midY - bbox.minY), height);
      const bottomDistance = safeDivide(Math.abs(midY - bbox.maxY), height);
      if (
        topDistance <= bottomDistance &&
        topDistance <= MAX_RECTANGLE_INTENT_SIDE_DISTANCE_RATIO
      ) {
        sideCoverages.top = Math.max(sideCoverages.top, coverage);
        sideDistances.top = Math.min(sideDistances.top, topDistance);
      } else if (bottomDistance <= MAX_RECTANGLE_INTENT_SIDE_DISTANCE_RATIO) {
        sideCoverages.bottom = Math.max(sideCoverages.bottom, coverage);
        sideDistances.bottom = Math.min(sideDistances.bottom, bottomDistance);
      }
    }

    if (vertical) {
      const coverage = clamp01(safeDivide(strokeBBox.maxY - strokeBBox.minY, height));
      if (coverage < MIN_RECTANGLE_INTENT_SIDE_COVERAGE) continue;

      const leftDistance = safeDivide(Math.abs(midX - bbox.minX), width);
      const rightDistance = safeDivide(Math.abs(midX - bbox.maxX), width);
      if (
        leftDistance <= rightDistance &&
        leftDistance <= MAX_RECTANGLE_INTENT_SIDE_DISTANCE_RATIO
      ) {
        sideCoverages.left = Math.max(sideCoverages.left, coverage);
        sideDistances.left = Math.min(sideDistances.left, leftDistance);
      } else if (rightDistance <= MAX_RECTANGLE_INTENT_SIDE_DISTANCE_RATIO) {
        sideCoverages.right = Math.max(sideCoverages.right, coverage);
        sideDistances.right = Math.min(sideDistances.right, rightDistance);
      }
    }
  }

  const coveredSides = Object.values(sideCoverages).filter(
    (coverage) => coverage >= MIN_RECTANGLE_INTENT_SIDE_COVERAGE
  );
  if (coveredSides.length < MIN_RECTANGLE_INTENT_SIDES) return null;

  const averageCoverage = safeDivide(
    coveredSides.reduce((sum, coverage) => sum + coverage, 0),
    coveredSides.length
  );
  const finiteDistances = Object.values(sideDistances).filter(
    (value) => Number.isFinite(value)
  );
  const averageDistance = safeDivide(
    finiteDistances.reduce((sum, value) => sum + value, 0),
    finiteDistances.length
  );

  return {
    confidence: clamp01(0.88 + averageCoverage * 0.1 - averageDistance * 0.08),
    sideCount: coveredSides.length,
    sideCoverages,
    sideDistances,
  };
};

const buildCumulativePathLengths = (points: StrokePoint[]): number[] => {
  const cumulative = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + distance(points[i - 1], points[i]);
  }
  return cumulative;
};

const extractBestLoopPoints = (points: StrokePoint[]): StrokePoint[] | null => {
  if (points.length < 10) return null;

  const bbox = getPointsBBox(points);
  if (!bbox) return null;
  const diagonal = getBBoxDiagonal(bbox);
  if (diagonal <= 0) return null;

  const cumulativePathLengths = buildCumulativePathLengths(points);
  const totalPathLength = cumulativePathLengths[cumulativePathLengths.length - 1] ?? 0;
  if (totalPathLength <= 0) return null;

  const maxJoinDistance = Math.max(10, Math.min(38, diagonal * MAX_LOOP_JOIN_RATIO));
  const minIndexSpan = Math.max(
    8,
    Math.floor(points.length * MIN_LOOP_INDEX_SPAN_RATIO)
  );
  const minPathSpan = diagonal * MIN_LOOP_PATH_TO_DIAGONAL_RATIO;
  let best: { start: number; end: number; score: number } | null = null;

  for (let start = 0; start < points.length - minIndexSpan; start += 1) {
    for (let end = start + minIndexSpan; end < points.length; end += 1) {
      const closureGap = distance(points[start], points[end]);
      if (closureGap > maxJoinDistance) continue;

      const pathSpan = cumulativePathLengths[end] - cumulativePathLengths[start];
      if (pathSpan < minPathSpan) continue;

      const trimmedEndpointCount = start + (points.length - 1 - end);
      if (trimmedEndpointCount < 2) continue;

      const score =
        pathSpan -
        closureGap * 4 -
        trimmedEndpointCount * Math.max(1, diagonal * 0.008);
      if (!best || score > best.score) best = { start, end, score };
    }
  }

  if (!best) return null;
  return points.slice(best.start, best.end + 1);
};

const getMinStrokeDistance = (a: Stroke, b: Stroke): number => {
  let minDistance = Infinity;
  for (const aPoint of a.points) {
    for (const bPoint of b.points) {
      minDistance = Math.min(minDistance, distance(aPoint, bPoint));
    }
  }
  return minDistance;
};

const hasConnectedStrokePoints = (strokes: Stroke[], diagonal: number): boolean => {
  if (strokes.length <= 1) return true;

  const maxJoinDistance = Math.max(18, diagonal * MAX_MULTI_STROKE_JOIN_RATIO);
  const visited = new Set<number>([0]);
  const queue = [0];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;

    for (let next = 0; next < strokes.length; next += 1) {
      if (visited.has(next)) continue;
      if (getMinStrokeDistance(strokes[current], strokes[next]) > maxJoinDistance) {
        continue;
      }

      visited.add(next);
      queue.push(next);
    }
  }

  return visited.size === strokes.length;
};

const getEndpointDistance = (
  a: StrokePoint,
  b: StrokePoint | undefined
): number => (b ? distance(a, b) : Infinity);

const buildTemplateInputPoints = (strokes: Stroke[]): StrokePoint[] => {
  if (strokes.length <= 1) return strokes[0]?.points ?? [];

  const remaining = strokes
    .map((stroke, index) => ({
      index,
      points: stroke.points,
      length: pathLength(stroke.points),
    }))
    .filter((entry) => entry.points.length > 0);
  if (remaining.length === 0) return [];

  const firstIndex = remaining.reduce(
    (bestIndex, entry, index) =>
      entry.length > remaining[bestIndex].length ? index : bestIndex,
    0
  );
  const [first] = remaining.splice(firstIndex, 1);
  const orderedPoints = [...first.points];

  while (remaining.length > 0) {
    const currentEnd = orderedPoints[orderedPoints.length - 1];
    let bestIndex = 0;
    let bestReverse = false;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index].points;
      const startDistance = getEndpointDistance(currentEnd, candidate[0]);
      const endDistance = getEndpointDistance(
        currentEnd,
        candidate[candidate.length - 1]
      );

      if (startDistance < bestDistance) {
        bestIndex = index;
        bestReverse = false;
        bestDistance = startDistance;
      }
      if (endDistance < bestDistance) {
        bestIndex = index;
        bestReverse = true;
        bestDistance = endDistance;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    const nextPoints = bestReverse ? [...next.points].reverse() : next.points;
    orderedPoints.push(...nextPoints);
  }

  return orderedPoints;
};

const buildBoxReplacementStroke = (
  source: Stroke,
  tool: Tool.Rectangle | Tool.Diamond | Tool.Ellipse,
  points: StrokePoint[]
): Stroke => {
  const bbox = getPointsBBox(points);
  if (!bbox) return source;

  return {
    id: createStrokeId(),
    tool,
    points: [
      { x: bbox.minX, y: bbox.minY, pressure: source.points[0]?.pressure ?? 0.5 },
      { x: bbox.maxX, y: bbox.maxY, pressure: source.points[0]?.pressure ?? 0.5 },
    ],
    color: source.color,
    thickness: source.thickness,
    drawableSeed: source.drawableSeed,
    shapeFill: source.shapeFill,
  };
};

const buildArrowReplacementStroke = (
  source: Stroke,
  points: StrokePoint[]
): Stroke => {
  const start = points[0];
  const tip = points.reduce(
    (best, current) =>
      distance(start, current) > distance(start, best) ? current : best,
    start
  );

  return {
    id: createStrokeId(),
    tool: Tool.Arrow,
    points: [start, tip],
    color: source.color,
    thickness: source.thickness,
    drawableSeed: source.drawableSeed,
  };
};

const getReplacementStroke = (
  kind: TemplateKind,
  source: Stroke,
  points: StrokePoint[]
): Stroke => {
  switch (kind) {
    case "arrow":
      return buildArrowReplacementStroke(source, points);
    case "diamond":
      return buildBoxReplacementStroke(source, Tool.Diamond, points);
    case "rectangle":
      return buildBoxReplacementStroke(source, Tool.Rectangle, points);
    case "ellipse":
      return buildBoxReplacementStroke(source, Tool.Ellipse, points);
  }
};

export const templateRecognizer: ShapeRecognizer = {
  kind: "ellipse",
  detect: (metrics, context) => {
    if (metrics.strokeCount < 1) return null;

    const source = context.sourceStrokes[0];
    const points = buildTemplateInputPoints(context.sourceStrokes);
    if (!source || points.length < 8) return null;

    const bbox = getPointsBBox(points);
    if (!bbox) return null;
    const diagonal = getBBoxDiagonal(bbox);
    if (diagonal < MIN_BBOX_DIAGONAL) return null;
    if (!hasConnectedStrokePoints(context.sourceStrokes, diagonal)) return null;
    const strokePathLength = context.sourceStrokes.reduce(
      (sum, stroke) => sum + pathLength(stroke.points),
      0
    );
    if (strokePathLength <= 0) return null;

    const rectangleIntent = getMultiStrokeRectangleIntent(
      context.sourceStrokes,
      bbox,
      diagonal
    );
    if (rectangleIntent) {
      return {
        kind: "rectangle",
        confidence: rectangleIntent.confidence,
        sourceStrokeIds: context.sourceStrokes.map((stroke) => stroke.id),
        replacementStrokes: [
          buildBoxReplacementStroke(source, Tool.Rectangle, points),
        ],
        reasons: [
          "template:multi-stroke-rectangle-intent",
          `rectangleIntentSides:${rectangleIntent.sideCount}`,
        ],
        debugGeometry: {
          mode: "template-rectangle-intent",
          rectangleIntentSides: rectangleIntent.sideCount,
          rectangleIntentSideCoverages: rectangleIntent.sideCoverages,
          rectangleIntentSideDistances: rectangleIntent.sideDistances,
        },
      };
    }

    const preferFullPolygon = hasMultiStrokePolygonStructure(
      context.sourceStrokes,
      points,
      diagonal
    );
    const match = getBestTemplateMatch(points, true, preferFullPolygon);
    if (!match || match.confidence < MIN_TEMPLATE_CONFIDENCE) return null;

    const matchPathLength = Math.max(1, pathLength(match.sourcePoints));
    const first = match.sourcePoints[0];
    const last = match.sourcePoints[match.sourcePoints.length - 1] ?? first;
    const chordToPathRatio = safeDivide(distance(first, last), matchPathLength);
    const quality = getTemplateGestureQuality(match.sourcePoints, diagonal);
    if (!isTemplateGesturePlausible(match, quality, chordToPathRatio)) {
      return null;
    }

    return {
      kind: match.template.kind,
      confidence: match.confidence,
      sourceStrokeIds: context.sourceStrokes.map((stroke) => stroke.id),
      replacementStrokes: [
        getReplacementStroke(match.template.kind, source, match.sourcePoints),
      ],
      reasons: [
        "template:$p",
        `templateName:${match.template.name}`,
        `templateDistance:${match.distance.toFixed(3)}`,
        `templateMargin:${match.confidenceMargin.toFixed(3)}`,
      ],
      debugGeometry: {
        mode: "template",
        templateName: match.template.name,
        templateDistance: match.distance,
        templateConfidence: match.confidence,
        templateConfidenceMargin: match.confidenceMargin,
        templateSecondBestConfidence: match.secondBestConfidence,
        templateSource: match.source,
        chordToPathRatio,
        ...quality,
      },
    };
  },
};

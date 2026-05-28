import { DetectionResult, ShapeDetectionCandidate, SmartAssistShapeKind } from "../types";

interface ResolveCandidatesConfig {
  minConfidence: Partial<Record<SmartAssistShapeKind, number>>;
  defaultMargin?: number;
  rectangleDiamondMargin?: number;
  polygonEllipseMargin?: number;
}

interface DebugBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const CLOSED_LOOP_ARROW_CHORD_TO_BBOX_DIAGONAL = 0.22;

const isDebugBBox = (value: unknown): value is DebugBBox => {
  if (!value || typeof value !== "object") return false;

  const bbox = value as Partial<DebugBBox>;
  return (
    typeof bbox.minX === "number" &&
    typeof bbox.minY === "number" &&
    typeof bbox.maxX === "number" &&
    typeof bbox.maxY === "number"
  );
};

const getClosedLoopArrowRatio = (
  candidate: ShapeDetectionCandidate
): number | null => {
  if (candidate.kind !== "arrow") return null;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return null;

  const { bbox, chordLength } = debugGeometry as {
    bbox?: unknown;
    chordLength?: unknown;
  };
  if (!isDebugBBox(bbox) || typeof chordLength !== "number") return null;

  const diagonal = Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
  if (diagonal === 0) return null;

  return chordLength / diagonal;
};

const isClosedLoopArrowCandidate = (
  candidate: ShapeDetectionCandidate
): boolean => {
  const ratio = getClosedLoopArrowRatio(candidate);
  return (
    ratio !== null &&
    ratio <= CLOSED_LOOP_ARROW_CHORD_TO_BBOX_DIAGONAL
  );
};

const hasSameSourceStrokes = (
  a: ShapeDetectionCandidate,
  b: ShapeDetectionCandidate
): boolean => {
  if (a.sourceStrokeIds.length !== b.sourceStrokeIds.length) return false;

  const sourceIds = new Set(a.sourceStrokeIds);
  return b.sourceStrokeIds.every((sourceId) => sourceIds.has(sourceId));
};

const hasStrongHeadEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.reasons.some((reason) => reason === "headEvidence:strong")) {
    return true;
  }

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const headEvidenceScore = (debugGeometry as { headEvidenceScore?: unknown })
    .headEvidenceScore;
  return typeof headEvidenceScore === "number" && headEvidenceScore >= 0.75;
};

const getPairMargin = (
  a: SmartAssistShapeKind,
  b: SmartAssistShapeKind,
  config: Required<ResolveCandidatesConfig>
): number => {
  const pair = [a, b].sort().join("-");
  if (pair === "diamond-rectangle") {
    return config.rectangleDiamondMargin;
  }
  if (
    pair === "diamond-ellipse" ||
    pair === "ellipse-rectangle"
  ) {
    return config.polygonEllipseMargin;
  }
  return config.defaultMargin;
};

export const resolveCandidates = (
  candidates: ShapeDetectionCandidate[],
  config: ResolveCandidatesConfig
): DetectionResult => {
  const resolvedConfig: Required<ResolveCandidatesConfig> = {
    minConfidence: config.minConfidence,
    defaultMargin: config.defaultMargin ?? 0.08,
    rectangleDiamondMargin: config.rectangleDiamondMargin ?? 0.12,
    polygonEllipseMargin: config.polygonEllipseMargin ?? 0.1,
  };

  if (candidates.length === 0) {
    return {
      accepted: false,
      winner: null,
      candidates,
      rejectedReason: "no-candidates",
    };
  }

  const eligible = candidates
    .filter((candidate) => !isClosedLoopArrowCandidate(candidate))
    .filter((candidate) => {
      const min = resolvedConfig.minConfidence[candidate.kind] ?? 1;
      return candidate.confidence >= min;
    })
    .sort((left, right) => right.confidence - left.confidence);

  if (eligible.length === 0) {
    return {
      accepted: false,
      winner: null,
      candidates,
      rejectedReason: "below-min-confidence",
    };
  }

  const [best, second] = eligible;
  if (!best) {
    return {
      accepted: false,
      winner: null,
      candidates,
      rejectedReason: "no-winner",
    };
  }

  const arrowAlternative = eligible.find((candidate) => candidate.kind === "arrow");
  const ellipseAlternative = eligible.find((candidate) => candidate.kind === "ellipse");
  const lineAlternative = eligible.find((candidate) => candidate.kind === "line");

  if (
    arrowAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(arrowAlternative, ellipseAlternative)
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      candidates,
    };
  }

  if (
    arrowAlternative &&
    lineAlternative &&
    arrowAlternative.confidence >= 0.82 &&
    hasStrongHeadEvidence(arrowAlternative)
  ) {
    return {
      accepted: true,
      winner: arrowAlternative,
      candidates,
    };
  }

  if (best.kind === "arrow") {
    if (lineAlternative) {
      const arrowCanBeatLine = best.confidence >= 0.82 && hasStrongHeadEvidence(best);
      if (!arrowCanBeatLine) {
        return {
          accepted: true,
          winner: lineAlternative,
          candidates,
        };
      }
    }
  }

  if (!second) {
    return {
      accepted: true,
      winner: best,
      candidates,
    };
  }

  const margin = getPairMargin(best.kind, second.kind, resolvedConfig);
  if (best.confidence - second.confidence < margin) {
    return {
      accepted: false,
      winner: null,
      candidates,
      rejectedReason: "ambiguous",
    };
  }

  return {
    accepted: true,
    winner: best,
    candidates,
  };
};

export type { ResolveCandidatesConfig };

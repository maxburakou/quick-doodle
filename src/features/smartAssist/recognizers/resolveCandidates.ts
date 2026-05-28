import { DetectionResult, ShapeDetectionCandidate, SmartAssistShapeKind } from "../types";

interface ResolveCandidatesConfig {
  minConfidence: Partial<Record<SmartAssistShapeKind, number>>;
  defaultMargin?: number;
  rectangleDiamondMargin?: number;
  polygonEllipseMargin?: number;
}

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
  const lineAlternative = eligible.find((candidate) => candidate.kind === "line");
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

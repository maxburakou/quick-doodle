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

const hasStrongAxisBoxEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "rectangle") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const axisBoxScore = (debugGeometry as { axisBoxScore?: unknown }).axisBoxScore;
  return typeof axisBoxScore === "number" && axisBoxScore >= 0.86;
};

const hasAxisBoxEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "rectangle") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  return typeof (debugGeometry as { axisBoxScore?: unknown }).axisBoxScore === "number";
};

const hasExtraRectangleCornerCandidates = (
  candidate: ShapeDetectionCandidate
): boolean => {
  if (candidate.kind !== "rectangle") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const rawCornerCount = (debugGeometry as { rawCornerCount?: unknown })
    .rawCornerCount;
  return typeof rawCornerCount === "number" && rawCornerCount > 4;
};

const hasCleanRectangleCorners = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "rectangle") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const { rawCornerCount, angleErrors, parallelErrors } = debugGeometry as {
    rawCornerCount?: unknown;
    angleErrors?: unknown;
    parallelErrors?: unknown;
  };
  if (rawCornerCount !== 4) return false;
  if (!Array.isArray(angleErrors) || !Array.isArray(parallelErrors)) return false;

  const maxAngleError = Math.max(
    ...angleErrors.filter((value): value is number => typeof value === "number")
  );
  const maxParallelError = Math.max(
    ...parallelErrors.filter((value): value is number => typeof value === "number")
  );

  return maxAngleError <= 18 && maxParallelError <= 18;
};

const hasStrongEllipseEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "ellipse") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const {
    radialMeanError,
    radialStd,
    cornerPenalty,
    angularCoverage,
  } = debugGeometry as {
    radialMeanError?: unknown;
    radialStd?: unknown;
    cornerPenalty?: unknown;
    angularCoverage?: unknown;
  };

  return (
    typeof radialMeanError === "number" &&
    typeof radialStd === "number" &&
    typeof cornerPenalty === "number" &&
    typeof angularCoverage === "number" &&
    radialMeanError <= 0.08 &&
    radialStd <= 0.1 &&
    cornerPenalty <= 0.14 &&
    angularCoverage >= 0.84
  );
};

const hasTemplateEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const { mode, templateConfidence } = debugGeometry as {
    mode?: unknown;
    templateConfidence?: unknown;
  };

  return (
    mode === "template" &&
    typeof templateConfidence === "number" &&
    templateConfidence >= 0.86
  );
};

const hasRoundedLoopEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "ellipse") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  if (hasTemplateEvidence(candidate)) return true;

  const {
    radialMeanError,
    radialStd,
    cornerPenalty,
    angularCoverage,
  } = debugGeometry as {
    radialMeanError?: unknown;
    radialStd?: unknown;
    cornerPenalty?: unknown;
    angularCoverage?: unknown;
  };

  return (
    typeof radialMeanError === "number" &&
    typeof radialStd === "number" &&
    typeof cornerPenalty === "number" &&
    typeof angularCoverage === "number" &&
    radialMeanError <= 0.16 &&
    radialStd <= 0.18 &&
    cornerPenalty <= 0.38 &&
    angularCoverage >= 0.9
  );
};

const hasLoopTailEllipseEvidence = (
  candidate: ShapeDetectionCandidate
): boolean => {
  if (candidate.kind !== "ellipse") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const {
    radialMeanError,
    radialStd,
    angularCoverage,
    trimmedEndpointCount,
  } = debugGeometry as {
    radialMeanError?: unknown;
    radialStd?: unknown;
    angularCoverage?: unknown;
    trimmedEndpointCount?: unknown;
  };

  return (
    typeof radialMeanError === "number" &&
    typeof radialStd === "number" &&
    typeof angularCoverage === "number" &&
    typeof trimmedEndpointCount === "number" &&
    trimmedEndpointCount >= 2 &&
    radialMeanError <= 0.08 &&
    radialStd <= 0.09 &&
    angularCoverage >= 0.9
  );
};

const hasStrongDiamondEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind !== "diamond") return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const { diamondAxisScore, midpointScore, vertexContactScore } =
    debugGeometry as {
      diamondAxisScore?: unknown;
      midpointScore?: unknown;
      vertexContactScore?: unknown;
    };

  if (typeof diamondAxisScore === "number" && diamondAxisScore >= 0.88) {
    return true;
  }

  return (
    typeof midpointScore === "number" &&
    typeof vertexContactScore === "number" &&
    midpointScore >= 0.8 &&
    vertexContactScore >= 0.68
  );
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

  const eligibleByKind = candidates
    .filter((candidate) => !isClosedLoopArrowCandidate(candidate))
    .filter((candidate) => {
      const min = resolvedConfig.minConfidence[candidate.kind] ?? 1;
      return candidate.confidence >= min;
    })
    .reduce((acc, candidate) => {
      const existing = acc.get(candidate.kind);
      if (!existing || candidate.confidence > existing.confidence) {
        acc.set(candidate.kind, candidate);
      }
      return acc;
    }, new Map<SmartAssistShapeKind, ShapeDetectionCandidate>());

  const eligible = [...eligibleByKind.values()].sort(
    (left, right) => right.confidence - left.confidence
  );

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
  const diamondAlternative = eligible.find((candidate) => candidate.kind === "diamond");
  const lineAlternative = eligible.find((candidate) => candidate.kind === "line");
  const rectangleAlternative = eligible.find(
    (candidate) => candidate.kind === "rectangle"
  );

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
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    (hasAxisBoxEvidence(rectangleAlternative) ||
      hasExtraRectangleCornerCandidates(rectangleAlternative)) &&
    !hasCleanRectangleCorners(rectangleAlternative) &&
    (hasStrongEllipseEvidence(ellipseAlternative) ||
      hasRoundedLoopEvidence(ellipseAlternative)) &&
    (ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.08 ||
      (hasLoopTailEllipseEvidence(ellipseAlternative) &&
        ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.18))
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      candidates,
    };
  }

  if (
    diamondAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(diamondAlternative, ellipseAlternative) &&
    (hasStrongEllipseEvidence(ellipseAlternative) ||
      hasRoundedLoopEvidence(ellipseAlternative)) &&
    (ellipseAlternative.confidence >= diamondAlternative.confidence + 0.03 ||
      (hasLoopTailEllipseEvidence(ellipseAlternative) &&
        ellipseAlternative.confidence >= diamondAlternative.confidence - 0.18) ||
      (!hasStrongDiamondEvidence(diamondAlternative) &&
        ellipseAlternative.confidence >= diamondAlternative.confidence - 0.12))
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasStrongAxisBoxEvidence(rectangleAlternative) &&
    hasTemplateEvidence(ellipseAlternative)
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      candidates,
    };
  }

  if (
    diamondAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(diamondAlternative, ellipseAlternative) &&
    hasStrongDiamondEvidence(diamondAlternative) &&
    hasTemplateEvidence(ellipseAlternative)
  ) {
    return {
      accepted: true,
      winner: diamondAlternative,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    diamondAlternative &&
    hasSameSourceStrokes(rectangleAlternative, diamondAlternative)
  ) {
    if (rectangleAlternative.confidence >= diamondAlternative.confidence + 0.06) {
      return {
        accepted: true,
        winner: rectangleAlternative,
        candidates,
      };
    }
    if (diamondAlternative.confidence >= rectangleAlternative.confidence + 0.06) {
      return {
        accepted: true,
        winner: diamondAlternative,
        candidates,
      };
    }
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    !hasAxisBoxEvidence(rectangleAlternative) &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence + 0.07
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasStrongAxisBoxEvidence(rectangleAlternative) &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence + 0.04
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
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

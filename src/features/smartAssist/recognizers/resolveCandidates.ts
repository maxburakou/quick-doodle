import { DetectionResult, ShapeDetectionCandidate, SmartAssistShapeKind } from "../types";

interface ResolveCandidatesConfig {
  minConfidence: Partial<Record<SmartAssistShapeKind, number>>;
  defaultMargin?: number;
  rectangleDiamondMargin?: number;
  polygonEllipseMargin?: number;
  sourceStrokeIds?: string[];
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

const coversSourceStrokes = (
  candidate: ShapeDetectionCandidate,
  sourceStrokeIds: string[]
): boolean => {
  if (sourceStrokeIds.length === 0) return true;
  if (candidate.sourceStrokeIds.length !== sourceStrokeIds.length) return false;

  const candidateSourceIds = new Set(candidate.sourceStrokeIds);
  return sourceStrokeIds.every((sourceId) => candidateSourceIds.has(sourceId));
};

const hasStrongHeadEvidence = (candidate: ShapeDetectionCandidate): boolean => {
  if (candidate.kind === "arrow" && hasTemplateEvidence(candidate)) {
    return true;
  }

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

const getAxisBoxScore = (candidate: ShapeDetectionCandidate): number | null => {
  if (candidate.kind !== "rectangle") return null;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return null;

  const axisBoxScore = (debugGeometry as { axisBoxScore?: unknown }).axisBoxScore;
  return typeof axisBoxScore === "number" ? axisBoxScore : null;
};

const hasVeryStrongAxisBoxEvidence = (
  candidate: ShapeDetectionCandidate
): boolean => {
  const axisBoxScore = getAxisBoxScore(candidate);
  return axisBoxScore !== null && axisBoxScore >= 0.9;
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

const hasPlausibleOpenEllipseEvidence = (
  candidate: ShapeDetectionCandidate
): boolean => {
  if (candidate.kind !== "ellipse" || hasTemplateEvidence(candidate)) return false;

  const debugGeometry = candidate.debugGeometry;
  if (!debugGeometry || typeof debugGeometry !== "object") return false;

  const {
    radialMeanError,
    radialStd,
    angularCoverage,
    cornerPenalty,
    closedness,
    quadrantCoverage,
  } = debugGeometry as {
    radialMeanError?: unknown;
    radialStd?: unknown;
    angularCoverage?: unknown;
    cornerPenalty?: unknown;
    closedness?: unknown;
    quadrantCoverage?: unknown;
  };

  return (
    typeof radialMeanError === "number" &&
    typeof radialStd === "number" &&
    typeof angularCoverage === "number" &&
    typeof cornerPenalty === "number" &&
    typeof closedness === "number" &&
    quadrantCoverage === 4 &&
    radialMeanError <= 0.13 &&
    radialStd <= 0.14 &&
    angularCoverage >= 0.82 &&
    cornerPenalty <= 0.2 &&
    closedness <= 0.72
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
  config: {
    defaultMargin: number;
    rectangleDiamondMargin: number;
    polygonEllipseMargin: number;
  }
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

const hasRequiredMargin = (
  winner: ShapeDetectionCandidate,
  runnerUp: ShapeDetectionCandidate,
  config: {
    defaultMargin: number;
    rectangleDiamondMargin: number;
    polygonEllipseMargin: number;
  }
): boolean =>
  winner.confidence - runnerUp.confidence >=
  getPairMargin(winner.kind, runnerUp.kind, config);

const pickBestCandidateForKind = (
  kindCandidates: ShapeDetectionCandidate[]
): ShapeDetectionCandidate | null => {
  const geometryCandidates = kindCandidates.filter(
    (candidate) => !hasTemplateEvidence(candidate)
  );
  const candidatesToRank =
    geometryCandidates.length > 0 ? geometryCandidates : kindCandidates;

  return candidatesToRank.sort((left, right) => right.confidence - left.confidence)[0] ??
    null;
};

export const resolveCandidates = (
  candidates: ShapeDetectionCandidate[],
  config: ResolveCandidatesConfig
): DetectionResult => {
  const resolvedConfig = {
    minConfidence: config.minConfidence,
    defaultMargin: config.defaultMargin ?? 0.08,
    rectangleDiamondMargin: config.rectangleDiamondMargin ?? 0.12,
    polygonEllipseMargin: config.polygonEllipseMargin ?? 0.1,
    sourceStrokeIds: config.sourceStrokeIds ?? [],
  };

  if (candidates.length === 0) {
    return {
      accepted: false,
      winner: null,
      candidates,
      rejectedReason: "no-candidates",
    };
  }

  const candidatesByConfidence = [...candidates].sort(
    (left, right) => right.confidence - left.confidence
  );
  const bestCandidate = candidatesByConfidence[0] ?? null;
  const runnerUpCandidate = candidatesByConfidence[1] ?? null;
  const rawMargin =
    bestCandidate && runnerUpCandidate
      ? bestCandidate.confidence - runnerUpCandidate.confidence
      : null;

  const fullBatchCandidates = candidates.filter((candidate) =>
    coversSourceStrokes(candidate, resolvedConfig.sourceStrokeIds)
  );
  if (fullBatchCandidates.length === 0) {
    return {
      accepted: false,
      winner: bestCandidate,
      runnerUp: runnerUpCandidate,
      margin: rawMargin,
      candidates,
      rejectedReason: "partial-batch-not-supported",
    };
  }

  const candidatesByKind = fullBatchCandidates
    .filter((candidate) => !isClosedLoopArrowCandidate(candidate))
    .reduce((acc, candidate) => {
      const existing = acc.get(candidate.kind) ?? [];
      existing.push(candidate);
      acc.set(candidate.kind, existing);
      return acc;
    }, new Map<SmartAssistShapeKind, ShapeDetectionCandidate[]>());

  const eligibleByKind = [...candidatesByKind.entries()].reduce(
    (acc, [kind, kindCandidates]) => {
      const bestForKind = pickBestCandidateForKind(kindCandidates);
      const min = resolvedConfig.minConfidence[kind] ?? 1;
      if (bestForKind && bestForKind.confidence >= min) {
        acc.set(kind, bestForKind);
      }
      return acc;
    },
    new Map<SmartAssistShapeKind, ShapeDetectionCandidate>()
  );

  const eligible = [...eligibleByKind.values()].sort(
    (left, right) => right.confidence - left.confidence
  );

  if (eligible.length === 0) {
    return {
      accepted: false,
      winner: bestCandidate,
      runnerUp: runnerUpCandidate,
      margin: rawMargin,
      candidates,
      rejectedReason: "below-threshold",
    };
  }

  let arrowAlternative = eligible.find((candidate) => candidate.kind === "arrow");
  let ellipseAlternative = eligible.find((candidate) => candidate.kind === "ellipse");
  let diamondAlternative = eligible.find((candidate) => candidate.kind === "diamond");
  let lineAlternative = eligible.find((candidate) => candidate.kind === "line");
  let rectangleAlternative = eligible.find(
    (candidate) => candidate.kind === "rectangle"
  );

  if (
    arrowAlternative &&
    lineAlternative &&
    hasSameSourceStrokes(arrowAlternative, lineAlternative) &&
    arrowAlternative.confidence >= lineAlternative.confidence &&
    !hasStrongHeadEvidence(arrowAlternative)
  ) {
    const lineCanStandIn =
      lineAlternative.confidence >= arrowAlternative.confidence - 0.04;
    if (!lineCanStandIn) {
      return {
        accepted: false,
        winner: arrowAlternative,
        runnerUp: lineAlternative,
        margin: arrowAlternative.confidence - lineAlternative.confidence,
        candidates,
        rejectedReason: "weak-arrow-head",
      };
    }
    eligible.splice(eligible.indexOf(arrowAlternative), 1);
    arrowAlternative = undefined;
    lineAlternative = eligible.find((candidate) => candidate.kind === "line");
    ellipseAlternative = eligible.find((candidate) => candidate.kind === "ellipse");
    diamondAlternative = eligible.find((candidate) => candidate.kind === "diamond");
    rectangleAlternative = eligible.find(
      (candidate) => candidate.kind === "rectangle"
    );
  }

  const [best, second] = eligible;
  if (!best) {
    return {
      accepted: false,
      winner: bestCandidate,
      runnerUp: runnerUpCandidate,
      margin: rawMargin,
      candidates,
      rejectedReason: "ambiguous",
    };
  }

  if (
    arrowAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(arrowAlternative, ellipseAlternative) &&
    hasRequiredMargin(ellipseAlternative, arrowAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: arrowAlternative,
      margin: ellipseAlternative.confidence - arrowAlternative.confidence,
      candidates,
    };
  }

  if (
    diamondAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(diamondAlternative, ellipseAlternative) &&
    hasPlausibleOpenEllipseEvidence(ellipseAlternative) &&
    (diamondAlternative.confidence < 0.91 ||
      !hasStrongDiamondEvidence(diamondAlternative)) &&
    (ellipseAlternative.confidence >= diamondAlternative.confidence - 0.16 ||
      diamondAlternative.confidence < 0.9)
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: diamondAlternative,
      margin: ellipseAlternative.confidence - diamondAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    rectangleAlternative.confidence >= 0.93 &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence + 0.04
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    !hasAxisBoxEvidence(rectangleAlternative) &&
    !hasCleanRectangleCorners(rectangleAlternative) &&
    hasPlausibleOpenEllipseEvidence(ellipseAlternative) &&
    ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.08
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: rectangleAlternative,
      margin: ellipseAlternative.confidence - rectangleAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasStrongAxisBoxEvidence(rectangleAlternative) &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence - 0.04
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    (getAxisBoxScore(rectangleAlternative) ?? 0) >= 0.82 &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence - 0.01
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    (getAxisBoxScore(rectangleAlternative) ?? 0) >= 0.8 &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasVeryStrongAxisBoxEvidence(rectangleAlternative) &&
    rectangleAlternative.confidence >= ellipseAlternative.confidence + 0.02
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
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
    !hasVeryStrongAxisBoxEvidence(rectangleAlternative) &&
    rectangleAlternative.confidence < 0.93 &&
    (hasStrongEllipseEvidence(ellipseAlternative) ||
      hasRoundedLoopEvidence(ellipseAlternative)) &&
    (ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.12 ||
      (hasLoopTailEllipseEvidence(ellipseAlternative) &&
        ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.14))
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: rectangleAlternative,
      margin: ellipseAlternative.confidence - rectangleAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    !hasVeryStrongAxisBoxEvidence(rectangleAlternative) &&
    (hasStrongEllipseEvidence(ellipseAlternative) ||
      hasRoundedLoopEvidence(ellipseAlternative)) &&
    ellipseAlternative.confidence >= rectangleAlternative.confidence - 0.02
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: rectangleAlternative,
      margin: ellipseAlternative.confidence - rectangleAlternative.confidence,
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
        ellipseAlternative.confidence >= diamondAlternative.confidence - 0.12)) &&
    hasRequiredMargin(ellipseAlternative, diamondAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: ellipseAlternative,
      runnerUp: diamondAlternative,
      margin: ellipseAlternative.confidence - diamondAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasStrongAxisBoxEvidence(rectangleAlternative) &&
    hasTemplateEvidence(ellipseAlternative) &&
    hasRequiredMargin(rectangleAlternative, ellipseAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    diamondAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(diamondAlternative, ellipseAlternative) &&
    hasStrongDiamondEvidence(diamondAlternative) &&
    hasTemplateEvidence(ellipseAlternative) &&
    hasRequiredMargin(diamondAlternative, ellipseAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: diamondAlternative,
      runnerUp: ellipseAlternative,
      margin: diamondAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    diamondAlternative &&
    hasSameSourceStrokes(rectangleAlternative, diamondAlternative)
  ) {
    if (
      rectangleAlternative.confidence >=
      diamondAlternative.confidence + resolvedConfig.rectangleDiamondMargin
    ) {
      return {
        accepted: true,
        winner: rectangleAlternative,
        runnerUp: diamondAlternative,
        margin: rectangleAlternative.confidence - diamondAlternative.confidence,
        candidates,
      };
    }
    if (
      diamondAlternative.confidence >=
      rectangleAlternative.confidence + resolvedConfig.rectangleDiamondMargin
    ) {
      return {
        accepted: true,
        winner: diamondAlternative,
        runnerUp: rectangleAlternative,
        margin: diamondAlternative.confidence - rectangleAlternative.confidence,
        candidates,
      };
    }
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    !hasAxisBoxEvidence(rectangleAlternative) &&
    hasRequiredMargin(rectangleAlternative, ellipseAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    rectangleAlternative &&
    ellipseAlternative &&
    hasSameSourceStrokes(rectangleAlternative, ellipseAlternative) &&
    hasStrongAxisBoxEvidence(rectangleAlternative) &&
    hasRequiredMargin(rectangleAlternative, ellipseAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: rectangleAlternative,
      runnerUp: ellipseAlternative,
      margin: rectangleAlternative.confidence - ellipseAlternative.confidence,
      candidates,
    };
  }

  if (
    arrowAlternative &&
    lineAlternative &&
    arrowAlternative.confidence >= 0.82 &&
    hasStrongHeadEvidence(arrowAlternative) &&
    hasRequiredMargin(arrowAlternative, lineAlternative, resolvedConfig)
  ) {
    return {
      accepted: true,
      winner: arrowAlternative,
      runnerUp: lineAlternative,
      margin: arrowAlternative.confidence - lineAlternative.confidence,
      candidates,
    };
  }

  if (best.kind === "arrow") {
    if (lineAlternative) {
      const arrowCanBeatLine = best.confidence >= 0.82 && hasStrongHeadEvidence(best);
      if (!arrowCanBeatLine) {
        return {
          accepted: lineAlternative.confidence >= best.confidence - 0.04,
          winner:
            lineAlternative.confidence >= best.confidence - 0.04
              ? lineAlternative
              : best,
          runnerUp:
            lineAlternative.confidence >= best.confidence - 0.04
              ? best
              : lineAlternative,
          margin: Math.abs(lineAlternative.confidence - best.confidence),
          candidates,
          rejectedReason:
            lineAlternative.confidence >= best.confidence - 0.04
              ? undefined
              : "weak-arrow-head",
        };
      }
    } else if (!hasStrongHeadEvidence(best)) {
      return {
        accepted: false,
        winner: best,
        runnerUp: second ?? null,
        margin: second ? best.confidence - second.confidence : null,
        candidates,
        rejectedReason: "weak-arrow-head",
      };
    }
  }

  if (!second) {
    return {
      accepted: true,
      winner: best,
      runnerUp: null,
      margin: null,
      candidates,
    };
  }

  const margin = getPairMargin(best.kind, second.kind, resolvedConfig);
  const actualMargin = best.confidence - second.confidence;
  if (actualMargin <= 0.02) {
    return {
      accepted: false,
      winner: best,
      runnerUp: second,
      margin: actualMargin,
      candidates,
      rejectedReason: "ambiguous",
    };
  }
  if (actualMargin < margin) {
    return {
      accepted: false,
      winner: best,
      runnerUp: second,
      margin: actualMargin,
      candidates,
      rejectedReason: "insufficient-margin",
    };
  }

  return {
    accepted: true,
    winner: best,
    runnerUp: second,
    margin: actualMargin,
    candidates,
  };
};

export type { ResolveCandidatesConfig };

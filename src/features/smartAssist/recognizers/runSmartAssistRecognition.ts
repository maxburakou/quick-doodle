import { SMART_ASSIST_CONFIG } from "../config";
import {
  DetectionResult,
  RecognizerContext,
  ShapeRecognizer,
  SmartAssistBatch,
} from "../types";
import { buildBatchMetrics } from "../utils";
import { arrowRecognizer } from "./arrowRecognizer";
import { diamondRecognizer } from "./diamondRecognizer";
import { ellipseRecognizer } from "./ellipseRecognizer";
import { rectangleRecognizer } from "./rectangleRecognizer";
import { resolveCandidates } from "./resolveCandidates";
import { lineRecognizer } from "./lineRecognizer";
import { templateRecognizer } from "./templateRecognizer";

const GEOMETRY_RECOGNIZERS: ShapeRecognizer[] = [
  diamondRecognizer,
  rectangleRecognizer,
  ellipseRecognizer,
  arrowRecognizer,
  lineRecognizer,
];
const SHAPE_RECOGNIZERS: ShapeRecognizer[] = [
  ...GEOMETRY_RECOGNIZERS,
  templateRecognizer,
];

const runRecognizers = (
  recognizers: ShapeRecognizer[],
  batch: SmartAssistBatch,
  context: RecognizerContext
): DetectionResult => {
  const metrics = buildBatchMetrics(batch.strokes);
  const candidates = recognizers
    .map((recognizer) => recognizer.detect(metrics, context))
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      candidate !== null
    );

  return resolveCandidates(candidates, {
    minConfidence: SMART_ASSIST_CONFIG.minConfidence,
  });
};

export const runSmartAssistRecognition = (
  batch: SmartAssistBatch,
  context: RecognizerContext
): DetectionResult => {
  const isMultiStrokeBatch = batch.strokes.length > 1;
  if (isMultiStrokeBatch) {
    return runRecognizers([templateRecognizer], batch, context);
  }

  const geometryResult = runRecognizers(GEOMETRY_RECOGNIZERS, batch, context);
  const shouldTemplateCheckAcceptedWinner =
    geometryResult.accepted &&
    (geometryResult.winner?.kind === "diamond" ||
      geometryResult.winner?.kind === "rectangle");
  if (geometryResult.accepted && !shouldTemplateCheckAcceptedWinner) {
    return geometryResult;
  }

  const templateResult = runRecognizers([templateRecognizer], batch, context);
  if (!templateResult.accepted) return geometryResult;

  const candidates = [...geometryResult.candidates, ...templateResult.candidates];
  return resolveCandidates(candidates, {
    minConfidence: SMART_ASSIST_CONFIG.minConfidence,
  });
};

export { GEOMETRY_RECOGNIZERS, SHAPE_RECOGNIZERS };

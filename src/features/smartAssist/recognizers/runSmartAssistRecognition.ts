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

const SHAPE_RECOGNIZERS: ShapeRecognizer[] = [
  diamondRecognizer,
  rectangleRecognizer,
  ellipseRecognizer,
  arrowRecognizer,
  lineRecognizer,
];

export const runSmartAssistRecognition = (
  batch: SmartAssistBatch,
  context: RecognizerContext
): DetectionResult => {
  const metrics = buildBatchMetrics(batch.strokes);
  const candidates = SHAPE_RECOGNIZERS
    .map((recognizer) => recognizer.detect(metrics, context))
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      candidate !== null
    );

  return resolveCandidates(candidates, {
    minConfidence: SMART_ASSIST_CONFIG.minConfidence,
  });
};

export { SHAPE_RECOGNIZERS };

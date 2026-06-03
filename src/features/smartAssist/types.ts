import { Stroke } from "@/types";
import { SmartBatchMetrics } from "./utils";

export type SmartAssistBatchStatus =
  | "collecting"
  | "recognizing-shape"
  | "text-candidate"
  | "recognizing-text"
  | "transitioning";

export type SmartAssistClearReason =
  | "disabled"
  | "tool-change"
  | "timeout"
  | "recognized"
  | "rejected"
  | "pointer-down-far"
  | "max-strokes"
  | "max-age"
  | "max-points"
  | "history-change"
  | "manual"
  | "undo-redo"
  | "window-blur"
  | "text-intent"
  | "text-recognized"
  | "text-empty"
  | "text-timeout"
  | "text-error"
  | "text-stale-source";

export interface SmartAssistBatch {
  id: string;
  strokeIds: string[];
  strokes: Stroke[];
  startedAt: number;
  updatedAt: number;
  status: SmartAssistBatchStatus;
}

export interface SmartAssistTransition {
  fromStrokes: Stroke[];
  toStrokes: Stroke[];
  targetIds: string[];
  startedAt: number;
  durationMs: number;
}

export interface SmartAssistDebugResult {
  batchId: string | null;
  recognizedShape: string | null;
  confidence: number;
  reason: SmartAssistClearReason;
  createdAt: number;
  rejectedReason?: DetectionRejectedReason;
  candidates?: ShapeDetectionCandidate[];
  winner?: ShapeDetectionCandidate | null;
  runnerUp?: ShapeDetectionCandidate | null;
  margin?: number | null;
  recognizedText?: string | null;
  textIntentScore?: number;
  textIntentReasons?: string[];
  textError?: string;
}

export type SmartAssistShapeKind =
  | "line"
  | "arrow"
  | "rectangle"
  | "diamond"
  | "ellipse";

export interface ShapeDetectionCandidate {
  kind: SmartAssistShapeKind;
  confidence: number;
  sourceStrokeIds: string[];
  replacementStrokes: Stroke[];
  reasons: string[];
  debugGeometry?: Record<string, unknown>;
}

export type DetectionRejectedReason =
  | "below-threshold"
  | "ambiguous"
  | "insufficient-margin"
  | "weak-arrow-head"
  | "partial-batch-not-supported"
  | "no-candidates";

export interface DetectionResult {
  accepted: boolean;
  winner: ShapeDetectionCandidate | null;
  candidates: ShapeDetectionCandidate[];
  runnerUp?: ShapeDetectionCandidate | null;
  margin?: number | null;
  rejectedReason?: DetectionRejectedReason;
}

export interface RecognizerContext {
  color: string;
  thickness: number;
  drawableSeed: number;
  shapeFill?: Stroke["shapeFill"];
  sourceStrokes: Stroke[];
}

export interface ShapeRecognizer {
  kind: SmartAssistShapeKind;
  detect: (
    metrics: SmartBatchMetrics,
    context: RecognizerContext
  ) => ShapeDetectionCandidate | null;
}

export interface SmartAssistConfig {
  enabledByDefault: boolean;
  shapeDebounceMs: number;
  maxBatchStrokes: number;
  maxBatchAgeMs: number;
  maxRawPoints: number;
  batchJoinPaddingPx: number;
  transitionDurationMs: number;
  text: {
    idleDebounceMs: number;
    maxBatchStrokes: number;
    maxBatchAgeMs: number;
    maxRawPoints: number;
    joinPaddingPx: number;
    intentThreshold: number;
    recognitionTimeoutMs: number;
  };
  minConfidence: Record<SmartAssistShapeKind, number>;
  conflictMarginsPx: Record<string, number>;
  snap: {
    distancePx: number;
    axisDistancePx: number;
    angleIntent: {
      axisMaxAngleDeltaDeg: number;
      diagonalMaxAngleDeltaDeg: number;
      axisMaxEndpointShiftRatio: number;
      diagonalMaxEndpointShiftRatio: number;
      axisMinEndpointShiftPx: number;
      diagonalMinEndpointShiftPx: number;
      axisMaxEndpointShiftPx: number;
      diagonalMaxEndpointShiftPx: number;
    };
  };
}

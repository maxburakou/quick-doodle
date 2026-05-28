import { Stroke } from "@/types";
import { SmartBatchMetrics } from "./utils";

export type SmartAssistBatchStatus =
  | "collecting"
  | "recognizing"
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
  | "window-blur";

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

export interface DetectionResult {
  accepted: boolean;
  winner: ShapeDetectionCandidate | null;
  candidates: ShapeDetectionCandidate[];
  rejectedReason?: string;
}

export interface RecognizerContext {
  color: string;
  thickness: number;
  drawableSeed: number;
  shapeFill?: Stroke["shapeFill"];
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
  debounceMs: number;
  maxBatchStrokes: number;
  maxBatchAgeMs: number;
  maxRawPoints: number;
  batchJoinPaddingPx: number;
  transitionDurationMs: number;
  minConfidence: Record<SmartAssistShapeKind, number>;
  conflictMarginsPx: Record<string, number>;
}

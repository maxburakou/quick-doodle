import { Stroke, StrokePoint, Tool } from "@/types";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useToolStore } from "@/store/useToolStore";
import { SMART_ASSIST_CONFIG } from "./config";
import { runSmartAssistRecognition } from "./recognizers";
import {
  DetectionResult,
  RecognizerContext,
  ShapeDetectionCandidate,
  SmartAssistBatch,
  SmartAssistClearReason,
} from "./types";
import { useSmartAssistStore } from "./useSmartAssistStore";
import { expandBBox, getStrokesBBox, isPointInBBox } from "./utils";

const createBatchId = () =>
  `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const countBatchRawPoints = (batch: SmartAssistBatch): number =>
  batch.strokes.reduce((acc, stroke) => acc + stroke.points.length, 0);

const isAppendCommittedPenStroke = (
  present: Stroke[],
  prevPresent: Stroke[]
): boolean => {
  if (present.length !== prevPresent.length + 1) return false;
  if (!prevPresent.every((stroke, index) => present[index]?.id === stroke.id)) {
    return false;
  }

  return present[present.length - 1]?.tool === Tool.Pen;
};

const shouldLogSmartAssistDebug = (): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem("quickDoodle.smartAssistDebug") === "1";
  } catch {
    return false;
  }
};

export class SmartAssistController {
  private recognitionTimer: number | null = null;
  private unsubscribeTool: (() => void) | null = null;
  private unsubscribeHistory: (() => void) | null = null;
  private unsubscribeEnabled: (() => void) | null = null;
  private onWindowBlur: (() => void) | null = null;

  constructor() {
    this.unsubscribeTool = useToolStore.subscribe((state, prevState) => {
      if (state.tool === prevState.tool) return;
      if (state.tool !== Tool.Pen) {
        this.clearBatch("tool-change");
      }
    });

    this.unsubscribeHistory = useHistoryStore.subscribe((state, prevState) => {
      const historyChanged =
        state.present !== prevState.present ||
        state.past !== prevState.past ||
        state.future !== prevState.future;
      if (!historyChanged) return;
      if (!useSmartAssistStore.getState().batch) return;
      if (isAppendCommittedPenStroke(state.present, prevState.present)) return;
      this.clearBatch("history-change");
    });

    this.unsubscribeEnabled = useSmartAssistStore.subscribe((state, prevState) => {
      if (state.enabled || state.enabled === prevState.enabled) return;
      this.clearBatch("disabled");
      this.finishTransitionNow();
    });

    if (typeof window !== "undefined") {
      this.onWindowBlur = () => this.clearBatch("window-blur");
      window.addEventListener("blur", this.onWindowBlur);
    }
  }

  enqueueCommittedPenStroke(stroke: Stroke) {
    const { enabled, batch } = useSmartAssistStore.getState();
    if (stroke.tool !== Tool.Pen) return;
    if (!enabled) return;

    const now = Date.now();
    const nextBatch = batch ?? {
      id: createBatchId(),
      strokeIds: [],
      strokes: [],
      startedAt: now,
      updatedAt: now,
      status: "collecting" as const,
    };

    const candidateBatch: SmartAssistBatch = {
      ...nextBatch,
      strokeIds: [...nextBatch.strokeIds, stroke.id],
      strokes: [...nextBatch.strokes, stroke],
      updatedAt: now,
      status: "collecting",
    };

    if (candidateBatch.strokes.length > SMART_ASSIST_CONFIG.maxBatchStrokes) {
      this.clearBatch("max-strokes");
      return;
    }
    if (now - candidateBatch.startedAt > SMART_ASSIST_CONFIG.maxBatchAgeMs) {
      this.clearBatch("max-age");
      return;
    }
    if (countBatchRawPoints(candidateBatch) > SMART_ASSIST_CONFIG.maxRawPoints) {
      this.clearBatch("max-points");
      return;
    }

    useSmartAssistStore.getState().setBatch(candidateBatch);

    this.cancelPendingTimer();
    this.recognitionTimer = window.setTimeout(() => {
      this.runRecognition();
    }, SMART_ASSIST_CONFIG.debounceMs);
  }

  handlePenPointerDown(point: StrokePoint) {
    const { transition, batch } = useSmartAssistStore.getState();
    if (transition) {
      this.finishTransitionNow();
    }
    if (!batch || batch.status !== "collecting") return;

    this.cancelPendingTimer();
    const bbox = getStrokesBBox(batch.strokes);
    if (!bbox) return;

    const expandedBBox = expandBBox(bbox, SMART_ASSIST_CONFIG.batchJoinPaddingPx);
    if (isPointInBBox(point, expandedBBox)) return;
    this.runRecognition();
  }

  clearBatch(reason: SmartAssistClearReason, detectionResult?: DetectionResult) {
    this.cancelPendingTimer();
    const { debugEnabled, batch, setBatch, setLastDebugResult } =
      useSmartAssistStore.getState();

    if (debugEnabled) {
      const winner = detectionResult?.winner ?? null;
      setLastDebugResult({
        batchId: batch?.id ?? null,
        recognizedShape:
          detectionResult?.accepted && winner ? winner.kind : null,
        confidence: winner?.confidence ?? 0,
        reason,
        rejectedReason: detectionResult?.rejectedReason,
        candidates: detectionResult?.candidates,
        winner,
        runnerUp: detectionResult?.runnerUp ?? null,
        margin: detectionResult?.margin ?? null,
        createdAt: Date.now(),
      });
    }

    setBatch(null);
  }

  cancelPendingTimer() {
    if (this.recognitionTimer === null) return;
    window.clearTimeout(this.recognitionTimer);
    this.recognitionTimer = null;
  }

  finishTransitionNow() {
    useSmartAssistStore.getState().clearTransition();
  }

  dispose() {
    this.cancelPendingTimer();
    this.unsubscribeTool?.();
    this.unsubscribeHistory?.();
    this.unsubscribeEnabled?.();
    if (typeof window !== "undefined" && this.onWindowBlur) {
      window.removeEventListener("blur", this.onWindowBlur);
    }
    this.unsubscribeTool = null;
    this.unsubscribeHistory = null;
    this.unsubscribeEnabled = null;
    this.onWindowBlur = null;
    if (singletonController === this) {
      singletonController = null;
    }
  }

  private buildRecognizerContext(batch: SmartAssistBatch): RecognizerContext {
    const baseStroke = batch.strokes[0];
    return {
      color: baseStroke?.color ?? "#000000",
      thickness: baseStroke?.thickness ?? 1,
      drawableSeed: baseStroke?.drawableSeed ?? Date.now(),
      shapeFill: baseStroke?.shapeFill,
      sourceStrokes: batch.strokes,
    };
  }

  private scheduleReplacement(winner: ShapeDetectionCandidate) {
    const historyState = useHistoryStore.getState();
    const presentIdSet = new Set(historyState.present.map((stroke) => stroke.id));
    const allSourceStrokesStillPresent = winner.sourceStrokeIds.every((id) =>
      presentIdSet.has(id)
    );

    if (!allSourceStrokesStillPresent) {
      this.clearBatch("history-change");
      return false;
    }

    const replaced = historyState.replaceStrokesWithAction(
      winner.sourceStrokeIds,
      winner.replacementStrokes
    );
    if (!replaced) {
      this.clearBatch("history-change");
      return false;
    }

    return true;
  }

  private runRecognition() {
    const { batch } = useSmartAssistStore.getState();
    if (!batch) return;

    useSmartAssistStore.getState().setBatch({
      ...batch,
      status: "recognizing",
      updatedAt: Date.now(),
    });

    const result = runSmartAssistRecognition(batch, this.buildRecognizerContext(batch));
    if (shouldLogSmartAssistDebug()) {
      console.debug("[Smart Assist] recognition", {
        accepted: result.accepted,
        rejectedReason: result.rejectedReason,
        winner: result.winner
          ? {
              kind: result.winner.kind,
              confidence: result.winner.confidence,
              reasons: result.winner.reasons,
              debugGeometry: result.winner.debugGeometry,
            }
          : null,
        runnerUp: result.runnerUp
          ? {
              kind: result.runnerUp.kind,
              confidence: result.runnerUp.confidence,
              reasons: result.runnerUp.reasons,
              debugGeometry: result.runnerUp.debugGeometry,
            }
          : null,
        margin: result.margin,
        candidates: result.candidates.map((candidate) => ({
          kind: candidate.kind,
          confidence: candidate.confidence,
          reasons: candidate.reasons,
          debugGeometry: candidate.debugGeometry,
        })),
      });
    }
    if (!result.accepted || !result.winner) {
      this.clearBatch("rejected", result);
      return;
    }

    const replaced = this.scheduleReplacement(result.winner);
    if (!replaced) return;
    this.clearBatch("recognized", result);
  }
}

let singletonController: SmartAssistController | null = null;

export const getSmartAssistController = () => {
  if (!singletonController) {
    singletonController = new SmartAssistController();
  }
  return singletonController;
};

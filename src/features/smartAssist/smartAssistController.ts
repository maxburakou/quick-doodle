import { Stroke, StrokePoint, Tool } from "@/types";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useToolStore } from "@/store/useToolStore";
import { SMART_ASSIST_CONFIG } from "./config";
import { SmartAssistBatch, SmartAssistClearReason } from "./types";
import { useSmartAssistStore } from "./useSmartAssistStore";
import {
  countBatchRawPoints,
  expandBBox,
  getBatchBBox,
  isPointInBBox,
} from "./utils";

const createBatchId = () =>
  `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
      this.runRecognitionStub();
    }, SMART_ASSIST_CONFIG.debounceMs);
  }

  handlePenPointerDown(point: StrokePoint) {
    const { transition, batch } = useSmartAssistStore.getState();
    if (transition) {
      this.finishTransitionNow();
    }
    if (!batch || batch.status !== "collecting") return;

    this.cancelPendingTimer();
    const bbox = getBatchBBox(batch);
    if (!bbox) return;

    const expandedBBox = expandBBox(bbox, SMART_ASSIST_CONFIG.batchJoinPaddingPx);
    if (isPointInBBox(point, expandedBBox)) return;
    this.clearBatch("pointer-down-far");
  }

  clearBatch(reason: SmartAssistClearReason) {
    this.cancelPendingTimer();
    const { debugEnabled, batch, setBatch, setLastDebugResult } =
      useSmartAssistStore.getState();

    if (debugEnabled) {
      setLastDebugResult({
        batchId: batch?.id ?? null,
        recognizedShape: null,
        confidence: 0,
        reason,
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

  private runRecognitionStub() {
    const { batch } = useSmartAssistStore.getState();
    if (!batch) return;

    useSmartAssistStore.getState().setBatch({
      ...batch,
      status: "recognizing",
      updatedAt: Date.now(),
    });

    this.clearBatch("timeout");
  }
}

let singletonController: SmartAssistController | null = null;

export const getSmartAssistController = () => {
  if (!singletonController) {
    singletonController = new SmartAssistController();
  }
  return singletonController;
};

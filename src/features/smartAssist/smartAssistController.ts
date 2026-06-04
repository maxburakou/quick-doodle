import { Stroke, StrokePoint, Tool } from "@/types";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useSnapStore } from "@/store/useSnapStore";
import { useToolStore } from "@/store/useToolStore";
import { SMART_ASSIST_CONFIG } from "./config";
import { runSmartAssistRecognition } from "./recognizers";
import { snapSmartAssistReplacementStrokes } from "./snapReplacementStrokes";
import { recognizeOnlineHandwriting } from "./textRecognition";
import { correctRecognizedText } from "./textCorrection";
import { recordTextRecognitionSample } from "./textRecognitionTelemetry";
import { buildTextReplacementAction } from "./textReplacement";
import { detectTextIntent, isPointLikelyContinuingTextBatch } from "./textIntent";
import { logSmartAssistDebug } from "./debug";
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

export class SmartAssistController {
  private recognitionTimer: number | null = null;
  private ignoreNextHistoryChange = false;
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
      if (this.ignoreNextHistoryChange) {
        this.ignoreNextHistoryChange = false;
        return;
      }
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
    const isTextBatch = batch?.status === "text-candidate";
    const nextBatch = batch ?? {
      id: createBatchId(),
      strokeIds: [],
      strokes: [],
      startedAt: now,
      updatedAt: now,
      status: "collecting" as const,
    };

    const batchDraft: SmartAssistBatch = {
      ...nextBatch,
      strokeIds: [...nextBatch.strokeIds, stroke.id],
      strokes: [...nextBatch.strokes, stroke],
      updatedAt: now,
      status: isTextBatch ? "text-candidate" : "collecting",
    };

    const predictedTextBatch =
      isTextBatch || this.shouldPromoteBatchToTextCandidate(batchDraft);

    const candidateBatch: SmartAssistBatch = {
      ...batchDraft,
      status: predictedTextBatch ? "text-candidate" : "collecting",
    };

    const maxBatchStrokes = predictedTextBatch
      ? SMART_ASSIST_CONFIG.text.maxBatchStrokes
      : SMART_ASSIST_CONFIG.maxBatchStrokes;
    const maxBatchAgeMs = predictedTextBatch
      ? SMART_ASSIST_CONFIG.text.maxBatchAgeMs
      : SMART_ASSIST_CONFIG.maxBatchAgeMs;
    const maxRawPoints = predictedTextBatch
      ? SMART_ASSIST_CONFIG.text.maxRawPoints
      : SMART_ASSIST_CONFIG.maxRawPoints;

    if (candidateBatch.strokes.length > maxBatchStrokes) {
      this.clearBatch("max-strokes");
      return;
    }
    if (now - candidateBatch.startedAt > maxBatchAgeMs) {
      this.clearBatch("max-age");
      return;
    }
    if (countBatchRawPoints(candidateBatch) > maxRawPoints) {
      this.clearBatch("max-points");
      return;
    }

    useSmartAssistStore.getState().setBatch(candidateBatch);
    logSmartAssistDebug("queued pen stroke for smart assist", {
      batchId: candidateBatch.id,
      batchStatus: candidateBatch.status,
      strokeCount: candidateBatch.strokes.length,
      rawPointCount: countBatchRawPoints(candidateBatch),
      strokeId: stroke.id,
      pointCount: stroke.points.length,
    });

    this.cancelPendingTimer();
    this.recognitionTimer = window.setTimeout(() => {
      if (candidateBatch.status === "text-candidate") {
        void this.runTextRecognition();
        return;
      }
      this.runShapeRecognition();
    }, predictedTextBatch ? SMART_ASSIST_CONFIG.text.idleDebounceMs : SMART_ASSIST_CONFIG.shapeDebounceMs);
  }

  handlePenPointerDown(point: StrokePoint) {
    const { transition, batch } = useSmartAssistStore.getState();
    if (transition) {
      this.finishTransitionNow();
    }
    if (!batch) return;

    this.cancelPendingTimer();
    if (batch.status === "text-candidate") {
      if (isPointLikelyContinuingTextBatch(point, batch)) return;

      useSmartAssistStore.getState().setBatch(null);
      void this.runTextRecognition(batch);
      return;
    }

    if (batch.status !== "collecting") return;

    const bbox = getStrokesBBox(batch.strokes);
    if (!bbox) return;

    const expandedBBox = expandBBox(bbox, SMART_ASSIST_CONFIG.batchJoinPaddingPx);
    if (isPointInBBox(point, expandedBBox)) return;
    this.runShapeRecognition();
  }

  clearBatch(
    reason: SmartAssistClearReason,
    detectionResult?: DetectionResult,
    textDebug?: {
      recognizedText?: string | null;
      textIntentScore?: number;
      textIntentReasons?: string[];
      textError?: string;
    }
  ) {
    this.cancelPendingTimer();
    const { debugEnabled, batch, setBatch, setLastDebugResult } =
      useSmartAssistStore.getState();
    logSmartAssistDebug("clearing smart assist batch", {
      batchId: batch?.id ?? null,
      reason,
      recognizedShape: detectionResult?.winner?.kind ?? null,
      recognizedText: textDebug?.recognizedText ?? null,
      textError: textDebug?.textError,
    });

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
        recognizedText: textDebug?.recognizedText ?? null,
        textIntentScore: textDebug?.textIntentScore,
        textIntentReasons: textDebug?.textIntentReasons,
        textError: textDebug?.textError,
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

  private shouldPromoteBatchToTextCandidate(batch: SmartAssistBatch): boolean {
    if (batch.strokes.length < SMART_ASSIST_CONFIG.text.earlyIntentMinStrokes) {
      return false;
    }

    const predictedIntent = detectTextIntent(
      batch,
      {
        accepted: false,
        winner: null,
        candidates: [],
      },
      this.buildRecognizerContext(batch)
    );

    const predicted = predictedIntent.score >= SMART_ASSIST_CONFIG.text.earlyIntentThreshold;
    logSmartAssistDebug("early text batch prediction", {
      batchId: batch.id,
      predicted,
      score: predictedIntent.score,
      threshold: SMART_ASSIST_CONFIG.text.earlyIntentThreshold,
      reasons: predictedIntent.reasons,
      debug: predictedIntent.debug,
      strokeCount: batch.strokes.length,
    });

    return predicted;
  }

  private getSnappedReplacementCandidate(
    winner: ShapeDetectionCandidate,
    present: Stroke[]
  ): ShapeDetectionCandidate {
    if (!useSnapStore.getState().enabled) return winner;

    const snapResult = snapSmartAssistReplacementStrokes({
      present,
      sourceStrokeIds: winner.sourceStrokeIds,
      replacementStrokes: winner.replacementStrokes,
    });

    if (!snapResult.changed) return winner;

    return {
      ...winner,
      replacementStrokes: snapResult.replacementStrokes,
      reasons: [...winner.reasons, "sceneSnap"],
    };
  }

  private replaceStrokesWithSmartAssistAction(
    sourceIds: string[],
    replacementStrokes: Stroke[]
  ): boolean {
    this.ignoreNextHistoryChange = true;
    const replaced = useHistoryStore
      .getState()
      .replaceStrokesWithAction(sourceIds, replacementStrokes);
    if (!replaced) {
      this.ignoreNextHistoryChange = false;
    }
    return replaced;
  }

  private scheduleReplacement(
    winner: ShapeDetectionCandidate
  ): ShapeDetectionCandidate | null {
    const historyState = useHistoryStore.getState();
    const presentIdSet = new Set(historyState.present.map((stroke) => stroke.id));
    const allSourceStrokesStillPresent = winner.sourceStrokeIds.every((id) =>
      presentIdSet.has(id)
    );

    if (!allSourceStrokesStillPresent) {
      this.clearBatch("history-change");
      return null;
    }

    const replacementCandidate = this.getSnappedReplacementCandidate(
      winner,
      historyState.present
    );
    const replaced = this.replaceStrokesWithSmartAssistAction(
      replacementCandidate.sourceStrokeIds,
      replacementCandidate.replacementStrokes
    );
    if (!replaced) {
      this.clearBatch("history-change");
      return null;
    }

    return replacementCandidate;
  }

  private runShapeRecognition() {
    const { batch } = useSmartAssistStore.getState();
    if (!batch) return;

    useSmartAssistStore.getState().setBatch({
      ...batch,
      status: "recognizing-shape",
      updatedAt: Date.now(),
    });

    const result = runSmartAssistRecognition(batch, this.buildRecognizerContext(batch));
    logSmartAssistDebug("shape recognition finished", {
      batchId: batch.id,
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
    if (!result.accepted || !result.winner) {
      const textIntent = detectTextIntent(
        batch,
        result,
        this.buildRecognizerContext(batch)
      );
      logSmartAssistDebug("text intent evaluated", {
        batchId: batch.id,
        probableText: textIntent.probableText,
        score: textIntent.score,
        reasons: textIntent.reasons,
        strokeCount: batch.strokes.length,
        debug: textIntent.debug,
      });
      if (textIntent.probableText) {
        useSmartAssistStore.getState().setBatch({
          ...batch,
          status: "text-candidate",
          updatedAt: Date.now(),
        });
        if (useSmartAssistStore.getState().debugEnabled) {
          useSmartAssistStore.getState().setLastDebugResult({
            batchId: batch.id,
            recognizedShape: null,
            confidence: 0,
            reason: "text-intent",
            rejectedReason: result.rejectedReason,
            candidates: result.candidates,
            winner: result.winner,
            runnerUp: result.runnerUp ?? null,
            margin: result.margin ?? null,
            textIntentScore: textIntent.score,
            textIntentReasons: textIntent.reasons,
            recognizedText: null,
            createdAt: Date.now(),
          });
        }
        this.cancelPendingTimer();
        this.recognitionTimer = window.setTimeout(() => {
          void this.runTextRecognition();
        }, SMART_ASSIST_CONFIG.text.idleDebounceMs);
        return;
      }

      this.clearBatch("rejected", result);
      return;
    }

    const replacementWinner = this.scheduleReplacement(result.winner);
    if (!replacementWinner) return;

    this.clearBatch("recognized", {
      ...result,
      winner: replacementWinner,
      candidates: result.candidates.map((candidate) =>
        candidate === result.winner ? replacementWinner : candidate
      ),
    });
  }

  private async runTextRecognition(snapshotBatch?: SmartAssistBatch) {
    const batch = snapshotBatch ?? useSmartAssistStore.getState().batch;
    if (!batch) return;
    logSmartAssistDebug("starting text recognition", {
      batchId: batch.id,
      snapshotBatch: Boolean(snapshotBatch),
      strokeCount: batch.strokes.length,
      rawPointCount: countBatchRawPoints(batch),
    });

    const currentBatch = useSmartAssistStore.getState().batch;
    if (!snapshotBatch && currentBatch?.id === batch.id) {
      useSmartAssistStore.getState().setBatch({
        ...batch,
        status: "recognizing-text",
        updatedAt: Date.now(),
      });
    }

    let text = "";
    let rawText = "";
    try {
      const result = await recognizeOnlineHandwriting(batch.strokes);
      rawText = result.text.trim();
      text = (await correctRecognizedText(rawText, result.candidates)).trim();
      recordTextRecognitionSample({
        batchId: batch.id,
        candidates: result.candidates,
        createdAt: Date.now(),
        engineMs: result.engineMs,
        finalText: text,
        rawText,
        runtime: result.runtime,
        strokes: batch.strokes,
      });
      logSmartAssistDebug("text recognition result", {
        batchId: batch.id,
        runtime: result.runtime,
        engineMs: result.engineMs,
        rawText,
        alternatives: result.alternatives,
        text,
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message === "text-recognition-timeout"
          ? "text-timeout"
          : "text-error";
      logSmartAssistDebug("text recognition failed", {
        batchId: batch.id,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      if (useSmartAssistStore.getState().batch?.id === batch.id) {
        this.clearBatch(reason, undefined, {
          textError: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (!text) {
      if (useSmartAssistStore.getState().batch?.id === batch.id) {
        this.clearBatch("text-empty", undefined, { recognizedText: "" });
      }
      return;
    }

    const historyState = useHistoryStore.getState();
    const presentIdSet = new Set(historyState.present.map((stroke) => stroke.id));
    const allSourceStrokesStillPresent = batch.strokeIds.every((id) =>
      presentIdSet.has(id)
    );
    if (!allSourceStrokesStillPresent) {
      if (useSmartAssistStore.getState().batch?.id === batch.id) {
        this.clearBatch("text-stale-source", undefined, { recognizedText: text });
      }
      return;
    }

    const replacementAction = buildTextReplacementAction({
      sourceStrokes: batch.strokes,
      sourceIds: batch.strokeIds,
      value: text,
      present: historyState.present,
    });
    if (!replacementAction) {
      if (useSmartAssistStore.getState().batch?.id === batch.id) {
        this.clearBatch("text-error", undefined, {
          recognizedText: text,
          textError: "failed-to-build-text-stroke",
        });
      }
      return;
    }

    const replaced = this.replaceStrokesWithSmartAssistAction(
      replacementAction.sourceIds,
      replacementAction.replacementStrokes
    );
    if (!replaced) {
      if (useSmartAssistStore.getState().batch?.id === batch.id) {
        this.clearBatch("text-stale-source", undefined, { recognizedText: text });
      }
      return;
    }

    logSmartAssistDebug("text replacement committed", {
      batchId: batch.id,
      text,
      mode: replacementAction.mode,
      appendTargetId: replacementAction.appendTargetId ?? null,
      placementReasons: replacementAction.placementReasons,
      replacementStrokeId: replacementAction.replacementStroke.id,
    });

    if (useSmartAssistStore.getState().batch?.id === batch.id) {
      this.clearBatch("text-recognized", undefined, { recognizedText: text });
    }
  }
}

let singletonController: SmartAssistController | null = null;

export const getSmartAssistController = () => {
  if (!singletonController) {
    singletonController = new SmartAssistController();
  }
  return singletonController;
};

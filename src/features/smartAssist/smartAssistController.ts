import { Stroke, StrokePoint, Tool } from "@/types";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useSnapStore } from "@/store/useSnapStore";
import { useToolSettingsStore } from "@/store/useToolSettingsStore";
import { SMART_ASSIST_CONFIG } from "./config";
import { runSmartAssistRecognition } from "./recognizers";
import { snapSmartAssistReplacementStrokes } from "./snapReplacementStrokes";
import {
  recognizeTextWithVision,
  type VisionTextRecognitionResult,
} from "./visionRecognition";
import { buildTextReplacementAction } from "./textReplacement";
import {
  detectEarlyTextIntent,
  detectTextIntent,
  isPointLikelyContinuingTextBatch,
} from "./textIntent";
import {
  DetectionResult,
  RecognizerContext,
  ShapeDetectionCandidate,
  SmartAssistBatch,
  SmartAssistClearReason,
} from "./types";
import { useSmartAssistStore } from "./useSmartAssistStore";
import { distanceSq, expandBBox, getStrokesBBox, isPointInBBox } from "./utils";

const createBatchId = () =>
  `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface TextRecognitionDebug {
  recognizedText?: string | null;
  textIntentScore?: number;
  textIntentReasons?: string[];
  textError?: string;
  visionSupported?: boolean | null;
  visionText?: string | null;
  visionConfidence?: number;
  visionError?: string | null;
}

interface VisionDebugSnapshot {
  supported: boolean | null;
  text: string | null;
  confidence: number;
  error: string | null;
}

interface SourceStrokeFingerprint {
  id: string;
  signature: string;
}

interface RecognitionSourceSnapshot {
  strokes: SourceStrokeFingerprint[];
}

interface RecognitionGuard {
  sessionId: number;
  batchId: string;
  source: RecognitionSourceSnapshot;
}

const countBatchRawPoints = (batch: SmartAssistBatch): number =>
  batch.strokes.reduce((acc, stroke) => acc + stroke.points.length, 0);

const RECENT_INTER_STROKE_GAP_LIMIT = 4;

const getPointerStillDelayMs = (batch: SmartAssistBatch): number => {
  const isTextCandidate = batch.status === "text-candidate";
  let baseDelay = isTextCandidate
    ? SMART_ASSIST_CONFIG.text.pointerStillMs
    : SMART_ASSIST_CONFIG.pointerStillMs;
  const graceDelay = isTextCandidate
    ? SMART_ASSIST_CONFIG.text.pointerStillInterStrokeGraceMs
    : SMART_ASSIST_CONFIG.pointerStillInterStrokeGraceMs;
  const maxDelay = isTextCandidate
    ? SMART_ASSIST_CONFIG.text.pointerStillMaxAdaptiveMs
    : SMART_ASSIST_CONFIG.pointerStillMaxAdaptiveMs;

  if (
    isTextCandidate &&
    (batch.lastStrokeStartDistanceFromPreviousEndPx ?? Number.POSITIVE_INFINITY) <=
      SMART_ASSIST_CONFIG.text.pointerStillConnectedStartPx
  ) {
    baseDelay = Math.max(
      baseDelay,
      SMART_ASSIST_CONFIG.text.pointerStillConnectedStartMs
    );
  }

  const gaps = batch.interStrokeGapsMs ?? [];
  if (gaps.length === 0) return baseDelay;

  const recentGaps = gaps.slice(-RECENT_INTER_STROKE_GAP_LIMIT);
  const recentGap = isTextCandidate
    ? recentGaps[recentGaps.length - 1] ?? 0
    : Math.max(...recentGaps);
  return Math.min(
    maxDelay,
    Math.max(baseDelay, recentGap + graceDelay)
  );
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getPointEventTime = (point: StrokePoint | null | undefined): number | null =>
  typeof point?.t === "number" && Number.isFinite(point.t) ? point.t : null;

const getPointerMoveElapsedMs = (
  from: StrokePoint | null,
  to: StrokePoint
): number => {
  const fromTime = getPointEventTime(from);
  const toTime = getPointEventTime(to);
  if (fromTime === null || toTime === null) {
    return SMART_ASSIST_CONFIG.pointerStillMicroMoveMs;
  }

  return Math.max(0, toTime - fromTime);
};

const getPointDistance = (
  previousPoint: StrokePoint | null | undefined,
  nextPoint: StrokePoint | null | undefined
): number | undefined => {
  if (!previousPoint || !nextPoint) return undefined;

  return Math.sqrt(distanceSq(previousPoint, nextPoint));
};

const getStrokeSourceSignature = (stroke: Stroke): string =>
  JSON.stringify({
    id: stroke.id,
    points: stroke.points,
    color: stroke.color,
    thickness: stroke.thickness,
    tool: stroke.tool,
    drawableSeed: stroke.drawableSeed,
    isShiftPressed: stroke.isShiftPressed,
    rotation: stroke.rotation,
    text: stroke.text,
    shapeFill: stroke.shapeFill,
  });

const createRecognitionSourceSnapshot = (
  strokes: Stroke[]
): RecognitionSourceSnapshot => ({
  strokes: strokes.map((stroke) => ({
    id: stroke.id,
    signature: getStrokeSourceSignature(stroke),
  })),
});

const recognitionSourceMatchesStrokes = (
  source: RecognitionSourceSnapshot,
  strokes: Stroke[]
): boolean => {
  if (source.strokes.length !== strokes.length) return false;

  return source.strokes.every((fingerprint, index) => {
    const stroke = strokes[index];
    return (
      stroke?.id === fingerprint.id &&
      getStrokeSourceSignature(stroke) === fingerprint.signature
    );
  });
};

const recognitionSourceMatchesPresent = (
  source: RecognitionSourceSnapshot,
  present: Stroke[]
): boolean => {
  const presentById = new Map(present.map((stroke) => [stroke.id, stroke]));

  return source.strokes.every((fingerprint) => {
    const stroke = presentById.get(fingerprint.id);
    return Boolean(
      stroke && getStrokeSourceSignature(stroke) === fingerprint.signature
    );
  });
};

const batchSourceMatchesPresent = (
  batch: SmartAssistBatch,
  present: Stroke[]
): boolean =>
  recognitionSourceMatchesPresent(
    createRecognitionSourceSnapshot(batch.strokes),
    present
  );

const withRecognitionTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("text-recognition-timeout"));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });

const toVisionDebugSnapshot = (
  result: VisionTextRecognitionResult | null,
  error?: unknown
): VisionDebugSnapshot => {
  if (result) {
    return {
      supported: result.supported,
      text: result.debug.spellcheck?.originalText ?? result.text,
      confidence: result.confidence,
      error: result.error ?? null,
    };
  }

  return {
    supported: null,
    text: null,
    confidence: 0,
    error: error === undefined ? "vision-unavailable" : getErrorMessage(error),
  };
};

const toTextDebug = (
  visionDebug: VisionDebugSnapshot | null,
  overrides: TextRecognitionDebug = {}
): TextRecognitionDebug => ({
  ...overrides,
  visionSupported: visionDebug?.supported,
  visionText: visionDebug?.text,
  visionConfidence: visionDebug?.confidence,
  visionError: visionDebug?.error,
});

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

const applySmartAssistShapeFill = (
  stroke: Stroke,
  enabled: boolean
): Stroke => ({
  ...stroke,
  shapeFill: enabled ? { color: stroke.color, style: "solid" } : undefined,
});

export class SmartAssistController {
  private recognitionSessionId = 0;
  private recognitionTimer: number | null = null;
  private pointerSettleTimer: number | null = null;
  private pointerSettleAnchor: StrokePoint | null = null;
  private pointerSettleBatchId: string | null = null;
  private lastPenPointerPoint: StrokePoint | null = null;
  private lastCommittedPenUpPoint: StrokePoint | null = null;
  private transitionTimer: number | null = null;
  private ignoreNextHistoryChange = false;
  private unsubscribeHistory: (() => void) | null = null;
  private unsubscribeEnabled: (() => void) | null = null;
  private onWindowBlur: (() => void) | null = null;

  constructor() {
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
      const batch = useSmartAssistStore.getState().batch;
      if (!batch) return;
      if (isAppendCommittedPenStroke(state.present, prevState.present)) return;
      if (batchSourceMatchesPresent(batch, state.present)) return;
      this.abortBatchRecognition("history-change");
    });

    this.unsubscribeEnabled = useSmartAssistStore.subscribe((state, prevState) => {
      if (state.enabled || state.enabled === prevState.enabled) return;
      this.abortBatchRecognition("disabled");
      this.finishTransitionNow();
    });

    if (typeof window !== "undefined") {
      this.onWindowBlur = () => this.abortBatchRecognition("window-blur");
      window.addEventListener("blur", this.onWindowBlur);
    }
  }

  enqueueCommittedPenStroke(stroke: Stroke, pointerUpPoint?: StrokePoint) {
    const { enabled, batch } = useSmartAssistStore.getState();
    if (stroke.tool !== Tool.Pen) return;
    if (!enabled) return;

    const now = Date.now();
    const isTextBatch = batch?.status === "text-candidate";
    const strokeStartPoint = stroke.points[0] ?? null;
    const pointerUpAnchor =
      pointerUpPoint ?? stroke.points[stroke.points.length - 1] ?? null;
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
      lastStrokeStartDistanceFromPreviousEndPx: getPointDistance(
        batch ? this.lastCommittedPenUpPoint : null,
        strokeStartPoint
      ),
      interStrokeGapsMs: batch
        ? [
            ...(batch.interStrokeGapsMs ?? []),
            now - batch.updatedAt,
          ].slice(-RECENT_INTER_STROKE_GAP_LIMIT)
        : [],
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
      this.abortBatchRecognition("max-strokes");
      return;
    }
    if (now - candidateBatch.startedAt > maxBatchAgeMs) {
      this.abortBatchRecognition("max-age");
      return;
    }
    if (countBatchRawPoints(candidateBatch) > maxRawPoints) {
      this.abortBatchRecognition("max-points");
      return;
    }

    useSmartAssistStore.getState().setBatch(candidateBatch);
    this.cancelPendingTimer();
    this.cancelPointerSettleTimer();
    this.lastPenPointerPoint = pointerUpAnchor;
    this.lastCommittedPenUpPoint = pointerUpAnchor;
    this.recognitionTimer = window.setTimeout(() => {
      if (candidateBatch.status === "text-candidate") {
        void this.runTextRecognition();
        return;
      }
      this.runShapeRecognition();
    }, predictedTextBatch ? SMART_ASSIST_CONFIG.text.idleDebounceMs : SMART_ASSIST_CONFIG.shapeDebounceMs);
    this.armPointerStillRecognition(candidateBatch, this.lastPenPointerPoint);
    this.scheduleArmedPointerStillRecognition(candidateBatch);
  }

  handlePenPointerDown(point: StrokePoint) {
    this.lastPenPointerPoint = point;
    const { transition, batch } = useSmartAssistStore.getState();
    if (transition) {
      this.finishTransitionNow();
    }
    if (!batch) return;

    this.cancelPointerSettleTimer();
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

  handlePenPointerMove(point: StrokePoint) {
    this.lastPenPointerPoint = point;
    if (!this.pointerSettleAnchor || !this.pointerSettleBatchId) return;

    const currentBatch = useSmartAssistStore.getState().batch;
    if (
      !currentBatch ||
      currentBatch.id !== this.pointerSettleBatchId ||
      (currentBatch.status !== "collecting" &&
        currentBatch.status !== "text-candidate")
    ) {
      this.cancelPointerSettleTimer();
      return;
    }

    const microMoveDistanceSq =
      SMART_ASSIST_CONFIG.pointerStillMicroMovePx *
      SMART_ASSIST_CONFIG.pointerStillMicroMovePx;
    const isMicroMove =
      distanceSq(point, this.pointerSettleAnchor) <= microMoveDistanceSq;
    const isEarlyMicroMove =
      isMicroMove &&
      getPointerMoveElapsedMs(this.pointerSettleAnchor, point) <
        SMART_ASSIST_CONFIG.pointerStillMicroMoveMs;

    if (isEarlyMicroMove) return;
    if (isMicroMove && this.pointerSettleTimer !== null) return;

    if (!isMicroMove) {
      this.pointerSettleAnchor = point;
    }
    this.scheduleArmedPointerStillRecognition(currentBatch);
  }

  clearBatch(
    reason: SmartAssistClearReason,
    detectionResult?: DetectionResult,
    textDebug?: TextRecognitionDebug
  ) {
    this.cancelPendingTimer();
    this.cancelPointerSettleTimer();
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
        recognizedText: textDebug?.recognizedText ?? null,
        textIntentScore: textDebug?.textIntentScore,
        textIntentReasons: textDebug?.textIntentReasons,
        textError: textDebug?.textError,
        visionSupported: textDebug?.visionSupported,
        visionText: textDebug?.visionText,
        visionConfidence: textDebug?.visionConfidence,
        visionError: textDebug?.visionError,
        createdAt: Date.now(),
      });
    }

    setBatch(null);
  }

  private abortBatchRecognition(
    reason: SmartAssistClearReason,
    detectionResult?: DetectionResult,
    textDebug?: TextRecognitionDebug
  ) {
    this.recognitionSessionId += 1;
    this.clearBatch(reason, detectionResult, textDebug);
  }

  private clearCurrentTextBatch(
    batch: SmartAssistBatch,
    guard: RecognitionGuard,
    reason: SmartAssistClearReason,
    textDebug: TextRecognitionDebug
  ) {
    if (!this.isRecognitionGuardCurrent(guard)) return;
    const currentBatch = useSmartAssistStore.getState().batch;
    if (!currentBatch || currentBatch.id !== batch.id) return;
    this.clearBatch(reason, undefined, textDebug);
  }

  private clearTextBatchAfterSuccessfulReplacement(
    batch: SmartAssistBatch,
    guard: RecognitionGuard,
    reason: SmartAssistClearReason,
    textDebug: TextRecognitionDebug
  ) {
    // After replacement, cleanup must not require source strokes to remain in present.
    if (guard.sessionId !== this.recognitionSessionId) return;
    if (!useSmartAssistStore.getState().enabled) return;
    const currentBatch = useSmartAssistStore.getState().batch;
    if (!currentBatch || currentBatch.id !== batch.id) return;
    this.clearBatch(reason, undefined, textDebug);
  }

  cancelPendingTimer() {
    if (this.recognitionTimer === null) return;
    window.clearTimeout(this.recognitionTimer);
    this.recognitionTimer = null;
  }

  private cancelPointerSettleTimer() {
    if (this.pointerSettleTimer !== null) {
      window.clearTimeout(this.pointerSettleTimer);
    }
    this.pointerSettleTimer = null;
    this.pointerSettleAnchor = null;
    this.pointerSettleBatchId = null;
  }

  private clearScheduledPointerSettleTimer() {
    if (this.pointerSettleTimer === null) return;
    window.clearTimeout(this.pointerSettleTimer);
    this.pointerSettleTimer = null;
  }

  private armPointerStillRecognition(
    batch: SmartAssistBatch,
    anchor: StrokePoint | null | undefined
  ) {
    if (!anchor) return;

    this.pointerSettleAnchor = anchor;
    this.pointerSettleBatchId = batch.id;
    this.pointerSettleTimer = null;
  }

  private scheduleArmedPointerStillRecognition(batch: SmartAssistBatch) {
    this.clearScheduledPointerSettleTimer();
    this.pointerSettleTimer = window.setTimeout(() => {
      const batchId = this.pointerSettleBatchId;
      this.pointerSettleTimer = null;
      this.pointerSettleAnchor = null;
      this.pointerSettleBatchId = null;

      const currentBatch = useSmartAssistStore.getState().batch;
      if (
        !currentBatch ||
        currentBatch.id !== batchId ||
        (currentBatch.status !== "collecting" &&
          currentBatch.status !== "text-candidate")
      ) {
        return;
      }

      this.cancelPendingTimer();
      if (currentBatch.status === "text-candidate") {
        void this.runTextRecognition();
        return;
      }

      this.runShapeRecognition();
    }, getPointerStillDelayMs(batch));
  }

  finishTransitionNow() {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    useSmartAssistStore.getState().clearTransition();
  }

  dispose() {
    this.abortBatchRecognition("manual");
    this.finishTransitionNow();
    this.unsubscribeHistory?.();
    this.unsubscribeEnabled?.();
    if (typeof window !== "undefined" && this.onWindowBlur) {
      window.removeEventListener("blur", this.onWindowBlur);
    }
    this.unsubscribeHistory = null;
    this.unsubscribeEnabled = null;
    this.onWindowBlur = null;
    this.lastPenPointerPoint = null;
    this.lastCommittedPenUpPoint = null;
    this.ignoreNextHistoryChange = false;
    if (singletonController === this) {
      singletonController = null;
    }
  }

  private buildRecognizerContext(batch: SmartAssistBatch): RecognizerContext {
    const shapeFillEnabled = useToolSettingsStore.getState().shapeFill;
    const sourceStrokes = batch.strokes.map((stroke) =>
      applySmartAssistShapeFill(stroke, shapeFillEnabled)
    );

    return {
      sourceStrokes,
    };
  }

  private shouldPromoteBatchToTextCandidate(batch: SmartAssistBatch): boolean {
    if (batch.strokes.length < SMART_ASSIST_CONFIG.text.earlyIntentMinStrokes) {
      return false;
    }

    const predictedIntent = detectEarlyTextIntent(batch);

    return predictedIntent.score >= SMART_ASSIST_CONFIG.text.earlyIntentThreshold;
  }

  private createRecognitionGuard(batch: SmartAssistBatch): RecognitionGuard {
    return {
      sessionId: this.recognitionSessionId,
      batchId: batch.id,
      source: createRecognitionSourceSnapshot(batch.strokes),
    };
  }

  private isRecognitionGuardCurrent(guard: RecognitionGuard): boolean {
    if (guard.sessionId !== this.recognitionSessionId) return false;
    if (!useSmartAssistStore.getState().enabled) return false;
    if (
      !recognitionSourceMatchesPresent(
        guard.source,
        useHistoryStore.getState().present
      )
    ) {
      return false;
    }

    const currentBatch = useSmartAssistStore.getState().batch;
    if (currentBatch?.id === guard.batchId) {
      return recognitionSourceMatchesStrokes(guard.source, currentBatch.strokes);
    }

    // Detached text recognition can still be valid while its source strokes are unchanged.
    return true;
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
    fromStrokes: Stroke[],
    replacementStrokes: Stroke[],
    guard: RecognitionGuard
  ): boolean {
    if (!this.isRecognitionGuardCurrent(guard)) return false;

    this.ignoreNextHistoryChange = true;
    const replaced = useHistoryStore
      .getState()
      .replaceStrokesWithAction(sourceIds, replacementStrokes);
    if (!replaced) {
      this.ignoreNextHistoryChange = false;
      return false;
    }

    this.startTransition(fromStrokes, replacementStrokes);
    return replaced;
  }

  private startTransition(fromStrokes: Stroke[], toStrokes: Stroke[]) {
    this.finishTransitionNow();
    if (fromStrokes.length === 0 || toStrokes.length === 0) return;

    useSmartAssistStore.getState().setTransition({
      fromStrokes,
      toStrokes,
      targetIds: toStrokes.map((stroke) => stroke.id),
      startedAt: Date.now(),
      durationMs: SMART_ASSIST_CONFIG.transitionDurationMs,
    });
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      useSmartAssistStore.getState().clearTransition();
    }, SMART_ASSIST_CONFIG.transitionDurationMs);
  }

  private scheduleReplacement(
    winner: ShapeDetectionCandidate,
    guard: RecognitionGuard
  ): ShapeDetectionCandidate | null {
    if (!this.isRecognitionGuardCurrent(guard)) return null;

    const historyState = useHistoryStore.getState();
    const presentIdSet = new Set(historyState.present.map((stroke) => stroke.id));
    const allSourceStrokesStillPresent = winner.sourceStrokeIds.every((id) =>
      presentIdSet.has(id)
    );

    if (!allSourceStrokesStillPresent) {
      this.abortBatchRecognition("history-change");
      return null;
    }

    const replacementCandidate = this.getSnappedReplacementCandidate(
      winner,
      historyState.present
    );
    const fromStrokes = historyState.present.filter((stroke) =>
      replacementCandidate.sourceStrokeIds.includes(stroke.id)
    );
    const replaced = this.replaceStrokesWithSmartAssistAction(
      replacementCandidate.sourceStrokeIds,
      fromStrokes,
      replacementCandidate.replacementStrokes,
      guard
    );
    if (!replaced) {
      this.abortBatchRecognition("history-change");
      return null;
    }

    return replacementCandidate;
  }

  private runShapeRecognition() {
    const { batch } = useSmartAssistStore.getState();
    if (!batch) return;
    const guard = this.createRecognitionGuard(batch);
    if (!this.isRecognitionGuardCurrent(guard)) return;

    useSmartAssistStore.getState().setBatch({
      ...batch,
      status: "recognizing-shape",
      updatedAt: Date.now(),
    });

    const result = runSmartAssistRecognition(batch, this.buildRecognizerContext(batch));
    if (!this.isRecognitionGuardCurrent(guard)) return;

    if (!result.accepted || !result.winner) {
      const textIntent = detectTextIntent(
        batch,
        result,
        this.buildRecognizerContext(batch)
      );
      if (!this.isRecognitionGuardCurrent(guard)) return;

      if (textIntent.probableText) {
        const textCandidateBatch: SmartAssistBatch = {
          ...batch,
          status: "text-candidate",
          updatedAt: Date.now(),
        };
        useSmartAssistStore.getState().setBatch({
          ...textCandidateBatch,
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
        this.cancelPointerSettleTimer();
        this.recognitionTimer = window.setTimeout(() => {
          void this.runTextRecognition();
        }, SMART_ASSIST_CONFIG.text.idleDebounceMs);
        this.armPointerStillRecognition(
          textCandidateBatch,
          this.lastPenPointerPoint
        );
        this.scheduleArmedPointerStillRecognition(textCandidateBatch);
        return;
      }

      this.clearBatch("rejected", result);
      return;
    }

    const replacementWinner = this.scheduleReplacement(result.winner, guard);
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
    const guard = this.createRecognitionGuard(batch);
    if (!this.isRecognitionGuardCurrent(guard)) return;

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
    let visionDebug: VisionDebugSnapshot | null = null;
    try {
      let visionResult: VisionTextRecognitionResult | null = null;
      try {
        visionResult = await withRecognitionTimeout(
          recognizeTextWithVision(batch.strokes),
          SMART_ASSIST_CONFIG.text.recognitionTimeoutMs
        );
        visionDebug = toVisionDebugSnapshot(visionResult);
      } catch (error) {
        visionDebug = toVisionDebugSnapshot(null, error);
        throw error;
      }

      rawText = visionResult?.text?.trim() ?? "";
      if (!rawText) throw new Error("text-recognition-empty-result");

      text = rawText;
      if (import.meta.env.DEV) {
        console.info("[SmartAssist Text]", {
          visionText: rawText,
          visionConfidence: visionResult?.confidence ?? 0,
          lines: visionResult?.lines.slice(0, 8) ?? [],
        });
      }
    } catch (error) {
      if (!this.isRecognitionGuardCurrent(guard)) return;
      const reason =
        error instanceof Error && error.message === "text-recognition-timeout"
          ? "text-timeout"
          : "text-error";
      this.clearCurrentTextBatch(
        batch,
        guard,
        reason,
        toTextDebug(visionDebug, { textError: getErrorMessage(error) })
      );
      return;
    }

    if (!this.isRecognitionGuardCurrent(guard)) return;

    if (!text) {
      this.clearCurrentTextBatch(
        batch,
        guard,
        "text-empty",
        toTextDebug(visionDebug, { recognizedText: "" })
      );
      return;
    }

    const historyState = useHistoryStore.getState();
    const presentIdSet = new Set(historyState.present.map((stroke) => stroke.id));
    const allSourceStrokesStillPresent = batch.strokeIds.every((id) =>
      presentIdSet.has(id)
    );
    if (!allSourceStrokesStillPresent) {
      this.clearCurrentTextBatch(
        batch,
        guard,
        "text-stale-source",
        toTextDebug(visionDebug, { recognizedText: text })
      );
      return;
    }

    const replacementAction = buildTextReplacementAction({
      sourceStrokes: batch.strokes,
      sourceIds: batch.strokeIds,
      value: text,
      present: historyState.present,
    });
    if (!this.isRecognitionGuardCurrent(guard)) return;

    if (!replacementAction) {
      this.clearCurrentTextBatch(
        batch,
        guard,
        "text-error",
        toTextDebug(visionDebug, {
          recognizedText: text,
          textError: "failed-to-build-text-stroke",
        })
      );
      return;
    }

    const replaced = this.replaceStrokesWithSmartAssistAction(
      replacementAction.sourceIds,
      historyState.present.filter((stroke) =>
        replacementAction.sourceIds.includes(stroke.id)
      ),
      replacementAction.replacementStrokes,
      guard
    );
    if (!replaced) {
      this.clearCurrentTextBatch(
        batch,
        guard,
        "text-stale-source",
        toTextDebug(visionDebug, { recognizedText: text })
      );
      return;
    }

    this.clearTextBatchAfterSuccessfulReplacement(
      batch,
      guard,
      "text-recognized",
      toTextDebug(visionDebug, { recognizedText: text })
    );
  }
}

let singletonController: SmartAssistController | null = null;

export const getSmartAssistController = () => {
  if (!singletonController) {
    singletonController = new SmartAssistController();
  }
  return singletonController;
};

import { SmartAssistConfig } from "./types";

export const SMART_ASSIST_CONFIG: SmartAssistConfig = {
  enabledByDefault: false,
  debounceMs: 650,
  maxBatchStrokes: 6,
  maxBatchAgeMs: 3000,
  maxRawPoints: 1800,
  batchJoinPaddingPx: 28,
  transitionDurationMs: 180,
  minConfidence: {
    line: 0.82,
    arrow: 0.82,
    rectangle: 0.82,
    diamond: 0.82,
    ellipse: 0.62,
  },
  conflictMarginsPx: {
    overlap: 12,
    endpoint: 16,
    axis: 10,
  },
};

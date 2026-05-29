import { SmartAssistConfig } from "./types";

export const SMART_ASSIST_CONFIG: SmartAssistConfig = {
  enabledByDefault: false,
  debounceMs: 650,
  maxBatchStrokes: 6,
  maxBatchAgeMs: 3000,
  maxRawPoints: 1800,
  batchJoinPaddingPx: 140,
  transitionDurationMs: 180,
  minConfidence: {
    line: 0.84,
    arrow: 0.82,
    rectangle: 0.8,
    diamond: 0.84,
    ellipse: 0.61,
  },
  conflictMarginsPx: {
    overlap: 12,
    endpoint: 16,
    axis: 10,
  },
};

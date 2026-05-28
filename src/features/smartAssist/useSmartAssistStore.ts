import { create } from "zustand";
import { SMART_ASSIST_CONFIG } from "./config";
import {
  SmartAssistBatch,
  SmartAssistDebugResult,
  SmartAssistTransition,
} from "./types";

interface SmartAssistState {
  enabled: boolean;
  debugEnabled: boolean;
  batch: SmartAssistBatch | null;
  transition: SmartAssistTransition | null;
  lastDebugResult: SmartAssistDebugResult | null;
  setEnabled: (enabled: boolean) => void;
  setDebugEnabled: (enabled: boolean) => void;
  setBatch: (batch: SmartAssistBatch | null) => void;
  setTransition: (transition: SmartAssistTransition | null) => void;
  setLastDebugResult: (result: SmartAssistDebugResult | null) => void;
  clearBatch: () => void;
  clearTransition: () => void;
  clearLastDebugResult: () => void;
}

export const useSmartAssistStore = create<SmartAssistState>((set) => ({
  enabled: SMART_ASSIST_CONFIG.enabledByDefault,
  debugEnabled: false,
  batch: null,
  transition: null,
  lastDebugResult: null,
  setEnabled: (enabled) => set({ enabled }),
  setDebugEnabled: (debugEnabled) => set({ debugEnabled }),
  setBatch: (batch) => set({ batch }),
  setTransition: (transition) => set({ transition }),
  setLastDebugResult: (lastDebugResult) => set({ lastDebugResult }),
  clearBatch: () => set({ batch: null }),
  clearTransition: () => set({ transition: null }),
  clearLastDebugResult: () => set({ lastDebugResult: null }),
}));

import {
  clearTextAdaptationState,
  exportTextAdaptationState,
  getTextAdaptationState,
  learnTextRecognitionPhrase,
} from "./textAdaptation";
import {
  clearTextRecognitionSamples,
  evaluateTextRecognitionSamples,
  exportTextRecognitionSamples,
  getTextRecognitionSamples,
  labelLastTextRecognitionSample,
} from "./textRecognitionTelemetry";

declare global {
  interface Window {
    quickDoodleSmartAssist?: {
      clearTextRecognitionSamples: typeof clearTextRecognitionSamples;
      clearTextAdaptationState: typeof clearTextAdaptationState;
      evaluateTextRecognitionSamples: typeof evaluateTextRecognitionSamples;
      exportTextAdaptationState: typeof exportTextAdaptationState;
      exportTextRecognitionSamples: typeof exportTextRecognitionSamples;
      getTextAdaptationState: typeof getTextAdaptationState;
      getTextRecognitionSamples: typeof getTextRecognitionSamples;
      labelLastTextRecognitionSample: typeof labelLastTextRecognitionSample;
      learnTextRecognitionPhrase: typeof learnTextRecognitionPhrase;
    };
  }
}

export const registerSmartAssistDebugApi = () => {
  if (typeof window === "undefined") return;

  window.quickDoodleSmartAssist = {
    clearTextAdaptationState,
    clearTextRecognitionSamples,
    evaluateTextRecognitionSamples,
    exportTextAdaptationState,
    exportTextRecognitionSamples,
    getTextAdaptationState,
    getTextRecognitionSamples,
    labelLastTextRecognitionSample,
    learnTextRecognitionPhrase,
  };
};

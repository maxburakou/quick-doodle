import { invoke } from "@tauri-apps/api/core";
import { Stroke } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";

export interface TextRecognitionResult {
  text: string;
  alternatives: string[];
  engineMs: number;
  runtime: "python-sidecar" | "unavailable";
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  let timeoutId: number | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("text-recognition-timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

export const recognizeOnlineHandwriting = (
  strokes: Stroke[]
): Promise<TextRecognitionResult> =>
  withTimeout(
    invoke<TextRecognitionResult>("online_htr_recognize", { strokes }),
    SMART_ASSIST_CONFIG.text.recognitionTimeoutMs
  );

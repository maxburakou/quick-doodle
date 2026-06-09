import { invoke } from "@tauri-apps/api/core";
import type { Stroke } from "@/types";
import { SmartAssistVisionRasterizerWorker } from "@/workers";
import { SMART_ASSIST_CONFIG } from "./config";
import {
  correctSmartAssistRecognizedText,
  type SmartAssistTextCorrectionDebug,
} from "./smartAssistTextCorrection";
import {
  DEFAULT_VISION_RASTERIZE_OPTIONS,
  renderStrokesForVisionOnMainThread,
  type VisionRasterizeResult,
} from "./visionRasterizer";

interface VisionRecognizedTextAlternative {
  text: string;
  confidence: number;
}

export interface VisionTextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionRecognizedTextLine {
  text: string;
  confidence: number;
  bounds: VisionTextBounds;
  alternatives: VisionRecognizedTextAlternative[];
}

interface VisionRecognizeTextResult {
  supported: boolean;
  text: string | null;
  confidence: number;
  lines: VisionRecognizedTextLine[];
  error?: string | null;
}

interface VisionRecognizeTextOptions {
  recognitionLevel: "accurate" | "fast";
  usesLanguageCorrection: boolean;
  recognitionLanguages: string[];
  minimumTextHeight: number | null;
  customWords: readonly string[];
}

const VISION_OPTIONS_HEADER = "x-quick-doodle-vision-options";
const RASTERIZE_WORKER_TIMEOUT_MS = 2000;

export interface VisionTextRecognitionResult extends VisionRecognizeTextResult {
  debug: VisionRecognitionDebug;
}

export interface VisionRecognitionDebug {
  supported: boolean | null;
  text: string | null;
  confidence: number;
  lines: VisionRecognizedTextLine[];
  error: string | null;
  spellcheck: SmartAssistTextCorrectionDebug | null;
  imageWidth: number;
  imageHeight: number;
  imageBytes: number;
  imageDataUrl: string | null;
}

interface VisionRasterizeWorkerResponse {
  id: number;
  ok: boolean;
  result?: VisionRasterizeResult | null;
  error?: string;
}

let rasterizerWorker: Worker | null = null;
let rasterizeRequestId = 0;

const canUseRasterizerWorker = () =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  "convertToBlob" in OffscreenCanvas.prototype;

const getRasterizerWorker = () => {
  if (!canUseRasterizerWorker()) return null;
  rasterizerWorker ??= new SmartAssistVisionRasterizerWorker();
  return rasterizerWorker;
};

const renderStrokesForVisionInWorker = (
  strokes: Stroke[]
): Promise<VisionRasterizeResult | null> => {
  const worker = getRasterizerWorker();
  if (!worker) return Promise.resolve(null);

  const id = (rasterizeRequestId += 1);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<VisionRasterizeWorkerResponse>) => {
      if (event.data.id !== id) return;

      cleanup();
      if (!event.data.ok) {
        reject(new Error(event.data.error ?? "vision-rasterizer-worker-error"));
        return;
      }
      resolve(event.data.result ?? null);
    };
    const handleError = (error: ErrorEvent) => {
      cleanup();
      reject(new Error(error.message || "vision-rasterizer-worker-error"));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("vision-rasterizer-worker-timeout"));
    }, RASTERIZE_WORKER_TIMEOUT_MS);

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({
      id,
      strokes,
      options: {
        ...DEFAULT_VISION_RASTERIZE_OPTIONS,
      },
    });
  });
};

const renderStrokesForVision = async (
  strokes: Stroke[]
): Promise<VisionRasterizeResult | null> => {
  try {
    const workerResult = await renderStrokesForVisionInWorker(strokes);
    if (workerResult) return workerResult;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[SmartAssist Vision] worker rasterization failed", error);
    }
  }

  return renderStrokesForVisionOnMainThread(strokes);
};

const normalizeVisionLineText = (text: string) =>
  text
    .replace(/\s+([!?,.:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const normalizeVisionText = (text: string) =>
  text
    .split(/\r?\n/)
    .map(normalizeVisionLineText)
    .filter(Boolean)
    .join("\n")
    .trim();

const normalizeVisionLines = (lines: VisionRecognizedTextLine[]) =>
  lines
    .map((line) => ({
      ...line,
      text: normalizeVisionLineText(line.text),
      alternatives: line.alternatives
        .map((alternative) => ({
          ...alternative,
          text: normalizeVisionLineText(alternative.text),
        }))
        .filter((alternative) => Boolean(alternative.text)),
    }))
    .filter((line) => Boolean(line.text));

export const recognizeTextWithVision = async (
  strokes: Stroke[]
): Promise<VisionTextRecognitionResult | null> => {
  if (typeof document === "undefined") return null;

  const renderResult = await renderStrokesForVision(strokes);
  if (!renderResult) return null;

  const setDebug = (debug: VisionRecognitionDebug) => {
    (globalThis as typeof globalThis & {
      __quickDoodleVisionDebug?: VisionRecognitionDebug;
    }).__quickDoodleVisionDebug = debug;
    if (import.meta.env.DEV) {
      console.info("[SmartAssist Vision]", debug);
    }
  };

  try {
    const result = await invoke<VisionRecognizeTextResult>(
      "smart_assist_vision_recognize_text",
      renderResult.imageBytes,
      {
        headers: {
          [VISION_OPTIONS_HEADER]: JSON.stringify(
            SMART_ASSIST_CONFIG.text.vision satisfies VisionRecognizeTextOptions
          ),
        },
      }
    );
    const debug: VisionRecognitionDebug = {
      supported: result.supported,
      text: result.text,
      confidence: result.confidence,
      lines: result.lines,
      error: result.error ?? null,
      spellcheck: null,
      imageWidth: renderResult.width,
      imageHeight: renderResult.height,
      imageBytes: renderResult.imageBytes.length,
      imageDataUrl: renderResult.imageDataUrl,
    };
    if (!result.supported) {
      setDebug(debug);
      return {
        ...result,
        text: null,
        lines: [],
        debug,
      };
    }

    const primaryText = result.text ? normalizeVisionText(result.text) : "";
    const lines = normalizeVisionLines(result.lines);
    const correction = primaryText
      ? await correctSmartAssistRecognizedText(primaryText)
      : { text: "", debug: null };
    const finalText = correction.text || primaryText;
    debug.text = finalText || null;
    debug.lines = lines;
    debug.spellcheck = correction.debug;
    setDebug(debug);

    return {
      ...result,
      text: finalText || null,
      lines,
      debug,
    };
  } catch (error) {
    setDebug({
      supported: null,
      text: null,
      confidence: 0,
      lines: [],
      error: error instanceof Error ? error.message : String(error),
      spellcheck: null,
      imageWidth: renderResult.width,
      imageHeight: renderResult.height,
      imageBytes: renderResult.imageBytes.length,
      imageDataUrl: renderResult.imageDataUrl,
    });
    return null;
  }
};

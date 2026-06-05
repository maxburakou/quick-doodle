import { invoke } from "@tauri-apps/api/core";
import { drawStrokes } from "@/components/Canvas/utils";
import type { Stroke } from "@/types";
import { getStrokesBBox } from "./utils";

interface VisionRecognizedTextCandidate {
  text: string;
  confidence: number;
}

interface VisionRecognizeTextResult {
  supported: boolean;
  text: string | null;
  confidence: number;
  candidates: VisionRecognizedTextCandidate[];
  error?: string | null;
}

export interface VisionTextRecognitionResult extends VisionRecognizeTextResult {
  recognitionCandidates: VisionTextRecognitionCandidate[];
  debug: VisionRecognitionDebug;
}

export interface VisionTextRecognitionCandidate {
  text: string;
  source: "vision";
  totalScore: number;
}

export interface VisionRecognitionDebug {
  supported: boolean | null;
  text: string | null;
  confidence: number;
  candidates: VisionRecognizedTextCandidate[];
  error: string | null;
  imageWidth: number;
  imageHeight: number;
  imageBytes: number;
  imageDataUrl: string | null;
}

interface VisionRenderResult {
  imageBytes: number[];
  imageDataUrl: string | null;
  width: number;
  height: number;
}

const VISION_IMAGE_PADDING_PX = 48;
const VISION_IMAGE_MIN_SIZE_PX = 96;
const VISION_IMAGE_MAX_SIZE_PX = 1800;
const VISION_IMAGE_SCALE = 2;
const VISION_CANDIDATE_CONFIDENCE_FLOOR = 0.25;
const VISION_INK_COLOR = "#0b0f14";

const toPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

const getVisionCanvasScale = (width: number, height: number) =>
  Math.min(
    VISION_IMAGE_SCALE,
    VISION_IMAGE_MAX_SIZE_PX / Math.max(width, height, 1)
  );

const buildVisionStroke = (
  stroke: Stroke,
  offsetX: number,
  offsetY: number,
  scale: number
): Stroke => ({
  ...stroke,
  color: VISION_INK_COLOR,
  thickness: Math.max(1, stroke.thickness * scale),
  points: stroke.points.map((point) => ({
    ...point,
    x: (point.x - offsetX) * scale,
    y: (point.y - offsetY) * scale,
  })),
});

const renderStrokesForVision = async (
  strokes: Stroke[]
): Promise<VisionRenderResult | null> => {
  const bbox = getStrokesBBox(strokes);
  if (!bbox) return null;

  const paddedWidth = bbox.maxX - bbox.minX + VISION_IMAGE_PADDING_PX * 2;
  const paddedHeight = bbox.maxY - bbox.minY + VISION_IMAGE_PADDING_PX * 2;
  const scale = getVisionCanvasScale(paddedWidth, paddedHeight);
  const width = Math.max(
    VISION_IMAGE_MIN_SIZE_PX,
    Math.ceil(paddedWidth * scale)
  );
  const height = Math.max(
    VISION_IMAGE_MIN_SIZE_PX,
    Math.ceil(paddedHeight * scale)
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const visionStrokes = strokes.map((stroke) =>
    buildVisionStroke(
      stroke,
      bbox.minX - VISION_IMAGE_PADDING_PX,
      bbox.minY - VISION_IMAGE_PADDING_PX,
      scale
    )
  );
  drawStrokes(visionStrokes, ctx);

  const blob = await toPngBlob(canvas);
  if (!blob) return null;

  return {
    imageBytes: [...new Uint8Array(await blob.arrayBuffer())],
    imageDataUrl: import.meta.env.DEV ? canvas.toDataURL("image/png") : null,
    width,
    height,
  };
};

const normalizeVisionText = (text: string) =>
  text
    .replace(/\s+([!?,.:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const toVisionCandidate = (
  candidate: VisionRecognizedTextCandidate
): VisionTextRecognitionCandidate | null => {
  const text = normalizeVisionText(candidate.text);
  if (!text || candidate.confidence < VISION_CANDIDATE_CONFIDENCE_FLOOR) return null;

  return {
    text,
    source: "vision",
    totalScore: candidate.confidence,
  };
};

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
      {
        request: { imageBytes: renderResult.imageBytes },
      }
    );
    const debug: VisionRecognitionDebug = {
      supported: result.supported,
      text: result.text,
      confidence: result.confidence,
      candidates: result.candidates,
      error: result.error ?? null,
      imageWidth: renderResult.width,
      imageHeight: renderResult.height,
      imageBytes: renderResult.imageBytes.length,
      imageDataUrl: renderResult.imageDataUrl,
    };
    setDebug(debug);
    if (!result.supported) {
      return {
        ...result,
        text: null,
        recognitionCandidates: [],
        debug,
      };
    }

    const primaryText = result.text ? normalizeVisionText(result.text) : "";
    const recognitionCandidates = [
      primaryText
        ? {
            text: primaryText,
            source: "vision" as const,
            totalScore: result.confidence,
          }
        : null,
      ...result.candidates.map(toVisionCandidate),
    ]
      .filter(
        (candidate): candidate is VisionTextRecognitionCandidate =>
          candidate !== null
      )
      .filter(
        (candidate, index, candidates) =>
          candidates.findIndex((item) => item.text === candidate.text) === index
      );

    return {
      ...result,
      text: primaryText || null,
      recognitionCandidates,
      debug,
    };
  } catch (error) {
    setDebug({
      supported: null,
      text: null,
      confidence: 0,
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
      imageWidth: renderResult.width,
      imageHeight: renderResult.height,
      imageBytes: renderResult.imageBytes.length,
      imageDataUrl: renderResult.imageDataUrl,
    });
    return null;
  }
};

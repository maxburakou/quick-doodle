import * as ort from "onnxruntime-web/wasm";
import { Stroke } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";

const MODEL_URL = "/models/online-htr/model.onnx";
const ALPHABET_URL = "/models/online-htr/alphabet.json";
const POINTS_PER_UNIT_LENGTH = 20;
const BLANK_INDEX = 0;

interface NormalizedSamplePoint {
  x: number;
  y: number;
  t: number;
  strokeNr: number;
}

interface InkFeatures {
  data: Float32Array;
  sequenceLength: number;
}

interface OnlineHtrRuntime {
  session: ort.InferenceSession;
  alphabet: string[];
}

export interface TextRecognitionResult {
  text: string;
  alternatives: string[];
  engineMs: number;
  runtime: "onnx-wasm" | "unavailable";
}

let runtimePromise: Promise<OnlineHtrRuntime> | null = null;

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

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const loadRuntime = async (): Promise<OnlineHtrRuntime> => {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      }),
      loadJson<string[]>(ALPHABET_URL),
    ]).then(([session, alphabet]) => ({ session, alphabet }));
  }

  return runtimePromise;
};

const flattenStrokes = (strokes: Stroke[]): NormalizedSamplePoint[] => {
  const rawPoints: NormalizedSamplePoint[] = [];
  let firstTimeMs: number | null = null;
  let fallbackIndex = 0;

  strokes.forEach((stroke, strokeNr) => {
    stroke.points.forEach((point) => {
      const timeMs = point.t ?? fallbackIndex * 16;
      if (firstTimeMs === null) {
        firstTimeMs = timeMs;
      }
      rawPoints.push({
        x: point.x,
        y: -point.y,
        t: (timeMs - firstTimeMs) / 1000,
        strokeNr,
      });
      fallbackIndex += 1;
    });
  });

  if (rawPoints.length === 0) return [];

  const firstX = rawPoints[0].x;
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const yScale = maxY - minY;
  const fallbackScale = Math.max(maxX - minX, 1);
  const scale = yScale > 1e-6 ? yScale : fallbackScale;

  return rawPoints.map((point) => ({
    ...point,
    x: (point.x - firstX) / scale,
    y: (point.y - minY) / scale,
  }));
};

const distance = (a: NormalizedSamplePoint, b: NormalizedSamplePoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const interpolate = (
  points: NormalizedSamplePoint[],
  targetTime: number,
  channel: "x" | "y" | "t"
) => {
  if (points.length === 1) return points[0][channel];
  if (targetTime <= points[0].t) return points[0][channel];
  const last = points[points.length - 1];
  if (targetTime >= last.t) return last[channel];

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    if (targetTime > next.t) continue;

    const span = Math.max(1e-6, next.t - prev.t);
    const ratio = (targetTime - prev.t) / span;
    return prev[channel] + (next[channel] - prev[channel]) * ratio;
  }

  return last[channel];
};

const makeStrictlyIncreasingTimes = (
  points: NormalizedSamplePoint[]
): NormalizedSamplePoint[] => {
  let prevTime = -Infinity;
  return points.map((point) => {
    const t = Math.max(point.t, prevTime + 0.001);
    prevTime = t;
    return { ...point, t };
  });
};

const resampleStroke = (
  points: NormalizedSamplePoint[]
): NormalizedSamplePoint[] => {
  if (points.length <= 1) return points;

  const normalized = makeStrictlyIncreasingTimes(points);
  const strokeLength = normalized.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + distance(normalized[index - 1], point);
  }, 0);
  let sampleCount = Math.ceil(strokeLength * POINTS_PER_UNIT_LENGTH);
  if (sampleCount === 1) sampleCount = 2;
  sampleCount = Math.max(2, sampleCount);

  const startTime = normalized[0].t;
  const endTime = normalized[normalized.length - 1].t;
  const timeSpan = Math.max(1e-6, endTime - startTime);

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const t = startTime + timeSpan * ratio;
    return {
      x: interpolate(normalized, t, "x"),
      y: interpolate(normalized, t, "y"),
      t: interpolate(normalized, t, "t"),
      strokeNr: normalized[0].strokeNr,
    };
  });
};

const buildInkFeatures = (strokes: Stroke[]): InkFeatures => {
  const normalized = flattenStrokes(strokes);
  if (normalized.length === 0) {
    throw new Error("empty-online-htr-input");
  }

  const byStroke = new Map<number, NormalizedSamplePoint[]>();
  normalized.forEach((point) => {
    const points = byStroke.get(point.strokeNr) ?? [];
    points.push(point);
    byStroke.set(point.strokeNr, points);
  });

  const resampled = [...byStroke.keys()]
    .sort((a, b) => a - b)
    .flatMap((strokeNr) => resampleStroke(byStroke.get(strokeNr) ?? []));
  if (resampled.length === 0) {
    throw new Error("empty-online-htr-features");
  }

  const data = new Float32Array(resampled.length * 4);
  resampled.forEach((point, index) => {
    const prev = resampled[index - 1];
    const base = index * 4;
    data[base] = index === 0 || !prev ? 0 : point.x - prev.x;
    data[base + 1] = index === 0 || !prev ? 0 : point.y - prev.y;
    data[base + 2] = index === 0 || !prev ? 0 : point.t - prev.t;
    data[base + 3] = index === 0 || !prev ? 1 : point.strokeNr - prev.strokeNr;
  });

  return {
    data,
    sequenceLength: resampled.length,
  };
};

const decodeGreedyCtc = (
  output: ort.Tensor,
  alphabet: string[]
): string => {
  const dimensions = output.dims;
  const classes = dimensions[dimensions.length - 1];
  const sequenceLength = dimensions[0];
  const values = output.data as Float32Array;
  const decoded: number[] = [];
  let previous = -1;

  for (let time = 0; time < sequenceLength; time += 1) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let classIndex = 0; classIndex < classes; classIndex += 1) {
      const value = values[time * classes + classIndex];
      if (value > bestValue) {
        bestValue = value;
        bestIndex = classIndex;
      }
    }

    if (bestIndex !== previous && bestIndex !== BLANK_INDEX) {
      decoded.push(bestIndex);
    }
    previous = bestIndex;
  }

  return decoded
    .map((index) => alphabet[index - 1] ?? "")
    .join("");
};

const runOnnxRecognition = async (
  strokes: Stroke[]
): Promise<TextRecognitionResult> => {
  const startedAt = performance.now();
  const [{ session, alphabet }, features] = await Promise.all([
    loadRuntime(),
    Promise.resolve(buildInkFeatures(strokes)),
  ]);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const input = new ort.Tensor("float32", features.data, [
    features.sequenceLength,
    1,
    4,
  ]);
  const output = await session.run({ [inputName]: input });
  const text = decodeGreedyCtc(output[outputName], alphabet);

  return {
    text,
    alternatives: [],
    engineMs: Math.round(performance.now() - startedAt),
    runtime: "onnx-wasm",
  };
};

export const recognizeOnlineHandwriting = (
  strokes: Stroke[]
): Promise<TextRecognitionResult> =>
  withTimeout(runOnnxRecognition(strokes), SMART_ASSIST_CONFIG.text.recognitionTimeoutMs);

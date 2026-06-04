import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { Stroke } from "@/types";
import { scoreTextLanguageCandidate } from "./textLanguageModel";

const MODEL_URL = new URL(
  "../../../models/online-htr/model.onnx",
  import.meta.url
).href;
const ALPHABET_URL = new URL(
  "../../../models/online-htr/alphabet.json",
  import.meta.url
).href;
const POINTS_PER_UNIT_LENGTH = 20;
const BLANK_INDEX = 0;
const CTC_BEAM_WIDTH = 64;
const CTC_TOP_CLASS_COUNT = 8;
const CTC_ALTERNATIVE_COUNT = 12;
const CTC_TOKEN_PRUNE_LOGP = -7.5;
const CTC_LANGUAGE_WEIGHT = 1.35;
const CTC_LENGTH_BONUS = 0.025;

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

type OnlineHtrAlphabetAsset = string[] | { alphabet: string[] };

export interface TextRecognitionResult {
  text: string;
  candidates: TextRecognitionCandidate[];
}

export interface TextRecognitionCandidate {
  text: string;
  acousticScore?: number;
  languageScore?: number;
  totalScore?: number;
  source: "beam" | "greedy";
}

let runtimePromise: Promise<OnlineHtrRuntime> | null = null;
let ortConfigured = false;

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const normalizeAlphabet = (asset: OnlineHtrAlphabetAsset): string[] => {
  const alphabet = Array.isArray(asset) ? asset : asset.alphabet;
  if (!Array.isArray(alphabet)) {
    throw new Error("invalid-online-htr-alphabet");
  }
  return alphabet;
};

const configureOnnxRuntime = () => {
  if (ortConfigured) return;

  // Keep the browser runtime on a simple, explicit path. This avoids Vite/dev-server
  // resolution issues where ORT ends up fetching JS/HTML instead of the wasm binary.
  ort.env.wasm.proxy = false;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = {
    wasm: ortWasmUrl,
  };

  ortConfigured = true;
};

const loadRuntime = async (): Promise<OnlineHtrRuntime> => {
  if (!runtimePromise) {
    configureOnnxRuntime();
    runtimePromise = Promise.all([
      ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      }),
      loadJson<OnlineHtrAlphabetAsset>(ALPHABET_URL),
    ])
      .then(([session, alphabetAsset]) => {
        const alphabet = normalizeAlphabet(alphabetAsset);
        return {
          session,
          alphabet,
        };
      })
      .catch((error) => {
        runtimePromise = null;
        throw error;
      });
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

interface CtcPrefixBeam {
  text: string;
  blankScore: number;
  nonBlankScore: number;
}

interface CtcAlternative {
  text: string;
  acousticScore: number;
  languageScore: number;
  totalScore: number;
}

const NEGATIVE_INFINITY = -Infinity;

const logAdd = (...values: number[]) => {
  const maxValue = Math.max(...values);
  if (maxValue === NEGATIVE_INFINITY) return NEGATIVE_INFINITY;

  const sum = values.reduce(
    (acc, value) => acc + Math.exp(value - maxValue),
    0
  );
  return maxValue + Math.log(sum);
};

const getFrameLogProbabilities = (
  values: Float32Array,
  time: number,
  classes: number
) => {
  const offset = time * classes;
  let maxValue = -Infinity;
  for (let classIndex = 0; classIndex < classes; classIndex += 1) {
    maxValue = Math.max(maxValue, values[offset + classIndex]);
  }

  let sum = 0;
  for (let classIndex = 0; classIndex < classes; classIndex += 1) {
    sum += Math.exp(values[offset + classIndex] - maxValue);
  }
  const logSum = maxValue + Math.log(Math.max(sum, Number.MIN_VALUE));

  const ranked = Array.from({ length: classes }, (_, classIndex) => ({
    classIndex,
    logProbability: values[offset + classIndex] - logSum,
  }))
    .sort((left, right) => right.logProbability - left.logProbability)
    .filter(
      (candidate, index) =>
        index < CTC_TOP_CLASS_COUNT ||
        candidate.classIndex === BLANK_INDEX ||
        candidate.logProbability >= CTC_TOKEN_PRUNE_LOGP
    );

  if (!ranked.some((candidate) => candidate.classIndex === BLANK_INDEX)) {
    ranked.push({
      classIndex: BLANK_INDEX,
      logProbability: values[offset + BLANK_INDEX] - logSum,
    });
  }

  return ranked;
};

const decodeBeamCtc = (output: ort.Tensor, alphabet: string[]) => {
  const dimensions = output.dims;
  const classes = dimensions[dimensions.length - 1];
  const sequenceLength = dimensions[0];
  const values = output.data as Float32Array;
  const languageScoreCache = new Map<string, number>();
  let beams: CtcPrefixBeam[] = [
    { text: "", blankScore: 0, nonBlankScore: NEGATIVE_INFINITY },
  ];

  const getLanguageScore = (text: string, prefixMode: boolean) => {
    const key = `${prefixMode ? "p" : "f"}:${text}`;
    const cached = languageScoreCache.get(key);
    if (cached !== undefined) return cached;

    const score = scoreTextLanguageCandidate(text, { prefixMode });
    languageScoreCache.set(key, score);
    return score;
  };

  const getBeamScore = (beam: CtcPrefixBeam, prefixMode: boolean) => {
    const acousticScore = logAdd(beam.blankScore, beam.nonBlankScore);
    return (
      acousticScore +
      getLanguageScore(beam.text, prefixMode) * CTC_LANGUAGE_WEIGHT +
      beam.text.length * CTC_LENGTH_BONUS
    );
  };

  const upsertBeam = (
    map: Map<string, CtcPrefixBeam>,
    text: string
  ): CtcPrefixBeam => {
    const existing = map.get(text);
    if (existing) return existing;

    const next = {
      text,
      blankScore: NEGATIVE_INFINITY,
      nonBlankScore: NEGATIVE_INFINITY,
    };
    map.set(text, next);
    return next;
  };

  for (let time = 0; time < sequenceLength; time += 1) {
    const frameTop = getFrameLogProbabilities(values, time, classes);
    const nextByText = new Map<string, CtcPrefixBeam>();

    beams.forEach((beam) => {
      const beamScore = logAdd(beam.blankScore, beam.nonBlankScore);

      frameTop.forEach(({ classIndex, logProbability }) => {
        if (classIndex === BLANK_INDEX) {
          const next = upsertBeam(nextByText, beam.text);
          next.blankScore = logAdd(
            next.blankScore,
            beamScore + logProbability
          );
          return;
        }

        const char = alphabet[classIndex - 1] ?? "";
        if (!char) return;

        const lastChar = beam.text[beam.text.length - 1];
        if (char === lastChar) {
          const repeated = upsertBeam(nextByText, beam.text);
          repeated.nonBlankScore = logAdd(
            repeated.nonBlankScore,
            beam.nonBlankScore + logProbability
          );

          const separatedText = `${beam.text}${char}`;
          const separated = upsertBeam(nextByText, separatedText);
          separated.nonBlankScore = logAdd(
            separated.nonBlankScore,
            beam.blankScore + logProbability
          );
          return;
        }

        const nextText = `${beam.text}${char}`;
        const next = upsertBeam(nextByText, nextText);
        next.nonBlankScore = logAdd(
          next.nonBlankScore,
          beamScore + logProbability
        );
      });
    });

    beams = [...nextByText.values()]
      .sort((left, right) => getBeamScore(right, true) - getBeamScore(left, true))
      .slice(0, CTC_BEAM_WIDTH);
  }

  const alternatives = beams
    .map((beam): CtcAlternative | null => {
      const text = beam.text.replace(/\s+/g, " ");
      if (!text.trim()) return null;

      const acousticScore = logAdd(beam.blankScore, beam.nonBlankScore);
      const languageScore = getLanguageScore(text, false);
      return {
        text,
        acousticScore,
        languageScore,
        totalScore:
          acousticScore +
          languageScore * CTC_LANGUAGE_WEIGHT +
          text.length * CTC_LENGTH_BONUS,
      };
    })
    .filter((alternative): alternative is CtcAlternative => alternative !== null);

  const bestByText = new Map<string, CtcAlternative>();
  alternatives.forEach((alternative) => {
    const existing = bestByText.get(alternative.text);
    if (!existing || alternative.totalScore > existing.totalScore) {
      bestByText.set(alternative.text, alternative);
    }
  });

  return [...bestByText.values()]
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, CTC_ALTERNATIVE_COUNT);
};

const runOnnxRecognition = async (
  strokes: Stroke[]
): Promise<TextRecognitionResult> => {
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
  const outputTensor = output[outputName];
  const greedyText = decodeGreedyCtc(outputTensor, alphabet);
  const beamAlternatives = decodeBeamCtc(outputTensor, alphabet);
  const rawCandidates: TextRecognitionCandidate[] = [
    ...beamAlternatives.map((alternative) => ({
      ...alternative,
      source: "beam" as const,
    })),
    ...(greedyText
      ? [
          {
            text: greedyText,
            source: "greedy" as const,
          },
        ]
      : []),
  ];
  const bestByText = new Map<string, TextRecognitionCandidate>();
  rawCandidates.forEach((candidate) => {
    const text = candidate.text.trim();
    if (!text) return;
    const existing = bestByText.get(text);
    if (
      !existing ||
      (candidate.totalScore ?? NEGATIVE_INFINITY) >
        (existing.totalScore ?? NEGATIVE_INFINITY)
    ) {
      bestByText.set(text, { ...candidate, text });
    }
  });
  const candidates = [...bestByText.values()]
    .sort(
      (left, right) =>
        (right.totalScore ?? NEGATIVE_INFINITY) -
        (left.totalScore ?? NEGATIVE_INFINITY)
    )
    .slice(0, CTC_ALTERNATIVE_COUNT);
  const alternatives = candidates.map(({ text }) => text);
  const text = alternatives[0] ?? greedyText;

  return {
    text,
    candidates,
  };
};

interface TextRecognitionWorkerRequest {
  jobId: number;
  strokes: Stroke[];
}

self.onmessage = async (event: MessageEvent<TextRecognitionWorkerRequest>) => {
  const { jobId, strokes } = event.data;

  try {
    const result = await runOnnxRecognition(strokes);
    self.postMessage({ jobId, result });
  } catch (error) {
    self.postMessage({
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};

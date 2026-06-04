import { Stroke } from "@/types";
import { learnTextRecognitionCorrection } from "./textAdaptation";
import { TextRecognitionCandidate } from "./textRecognition";

const STORAGE_KEY = "quickDoodle.smartAssistTextRecognitionSamples";
const MAX_SAMPLE_COUNT = 120;

export interface TextRecognitionTelemetrySample {
  batchId: string;
  candidates: TextRecognitionCandidate[];
  createdAt: number;
  engineMs: number;
  expectedText?: string;
  finalText: string;
  rawText: string;
  runtime: string;
  strokes: Stroke[];
}

export interface TextRecognitionEvalResult {
  characterErrorRate: number | null;
  exactMatches: number;
  labeledSamples: number;
  samples: number;
  totalCharacterDistance: number;
  totalExpectedCharacters: number;
  wordErrorRate: number | null;
  totalWordDistance: number;
  totalExpectedWords: number;
}

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

const levenshtein = <T>(left: T[], right: T[]) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) dp[row][0] = row;
  for (let col = 0; col < cols; col += 1) dp[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = Object.is(left[row - 1], right[col - 1]) ? 0 : 1;
      dp[row][col] = Math.min(
        dp[row - 1][col] + 1,
        dp[row][col - 1] + 1,
        dp[row - 1][col - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
};

const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ");

export const getTextRecognitionSamples = (): TextRecognitionTelemetrySample[] => {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveTextRecognitionSamples = (
  samples: TextRecognitionTelemetrySample[]
) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(samples.slice(-MAX_SAMPLE_COUNT))
    );
  } catch {
    // Storage can be unavailable or full; recognition should never depend on it.
  }
};

export const recordTextRecognitionSample = (
  sample: TextRecognitionTelemetrySample
) => {
  const samples = getTextRecognitionSamples();
  saveTextRecognitionSamples([...samples, sample]);
};

export const clearTextRecognitionSamples = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const labelLastTextRecognitionSample = (expectedText: string) => {
  const samples = getTextRecognitionSamples();
  const last = samples[samples.length - 1];
  if (!last) return null;

  const next = {
    ...last,
    expectedText: normalizeText(expectedText),
  };
  saveTextRecognitionSamples([...samples.slice(0, -1), next]);
  learnTextRecognitionCorrection(last.rawText, last.finalText, expectedText);
  return next;
};

const getWords = (text: string) =>
  normalizeText(text).split(/\s+/).filter(Boolean);

export const evaluateTextRecognitionSamples = (
  samples = getTextRecognitionSamples()
): TextRecognitionEvalResult => {
  const labeled = samples.filter((sample) => sample.expectedText);
  let exactMatches = 0;
  let totalCharacterDistance = 0;
  let totalExpectedCharacters = 0;
  let totalWordDistance = 0;
  let totalExpectedWords = 0;

  labeled.forEach((sample) => {
    const expected = normalizeText(sample.expectedText ?? "");
    const actual = normalizeText(sample.finalText);
    if (expected === actual) exactMatches += 1;

    totalCharacterDistance += levenshtein([...actual], [...expected]);
    totalExpectedCharacters += expected.length;

    const actualWords = getWords(actual);
    const expectedWords = getWords(expected);
    totalWordDistance += levenshtein(actualWords, expectedWords);
    totalExpectedWords += expectedWords.length;
  });

  return {
    characterErrorRate:
      totalExpectedCharacters > 0
        ? totalCharacterDistance / totalExpectedCharacters
        : null,
    exactMatches,
    labeledSamples: labeled.length,
    samples: samples.length,
    totalCharacterDistance,
    totalExpectedCharacters,
    wordErrorRate:
      totalExpectedWords > 0 ? totalWordDistance / totalExpectedWords : null,
    totalWordDistance,
    totalExpectedWords,
  };
};

export const exportTextRecognitionSamples = () =>
  JSON.stringify(getTextRecognitionSamples(), null, 2);

export const SMART_ASSIST_TEXT_RECOGNITION_SAMPLES_KEY = STORAGE_KEY;

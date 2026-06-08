import { invoke } from "@tauri-apps/api/core";
import { SMART_ASSIST_CONFIG } from "./config";
import { SMART_ASSIST_QUESTION_STARTERS } from "./smartAssistQuestionStarters";

const TEXT_CORRECTION_TIMEOUT_MS = 350;

export interface SmartAssistTextCorrectionDebug {
  supported: boolean | null;
  originalText: string;
  correctedText: string | null;
  didChange: boolean;
  reason: string | null;
  wordCount: number;
  replacementCount: number;
  error: string | null;
}

interface NativeTextCorrectionResult {
  supported: boolean;
  correctedText: string | null;
  didChange: boolean;
  reason?: string | null;
  wordCount: number;
  replacementCount: number;
  error?: string | null;
}

export interface SmartAssistTextCorrectionResult {
  text: string;
  debug: SmartAssistTextCorrectionDebug | null;
}

export const countRecognizedTextWords = (text: string) =>
  text.match(/[\p{L}\p{N}]+(?:[.'/-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

export const shouldUseNativeTextCorrection = (text: string) =>
  countRecognizedTextWords(text) > 1;

const normalizeCorrectedTextLine = (text: string) =>
  text
    .replace(/\s+([!?,.:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCorrectedText = (text: string) =>
  text
    .split(/\r?\n/)
    .map(normalizeCorrectedTextLine)
    .filter(Boolean)
    .join("\n")
    .trim();

export const applyQuestionPunctuationIntent = (text: string) => {
  if (countRecognizedTextWords(text) <= 1) return text;
  if (!/!\s*$/u.test(text)) return text;

  const firstWord = text.trim().match(/^\p{L}+/u)?.[0]?.toLowerCase();
  if (!firstWord || !SMART_ASSIST_QUESTION_STARTERS.has(firstWord)) return text;

  return text.replace(/!\s*$/u, "?");
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("text-correction-timeout"));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });

export const correctSmartAssistRecognizedText = async (
  text: string
): Promise<SmartAssistTextCorrectionResult> => {
  const wordCount = countRecognizedTextWords(text);
  if (!shouldUseNativeTextCorrection(text)) {
    return {
      text,
      debug: null,
    };
  }

  try {
    const nativeResult = await withTimeout(
      invoke<NativeTextCorrectionResult>("smart_assist_correct_text", {
        request: {
          text,
          language: SMART_ASSIST_CONFIG.text.vision.recognitionLanguages[0] ?? null,
          customWords: SMART_ASSIST_CONFIG.text.vision.customWords,
        },
      }),
      TEXT_CORRECTION_TIMEOUT_MS
    );
    const nativeText =
      nativeResult.supported && nativeResult.correctedText
        ? normalizeCorrectedText(nativeResult.correctedText)
        : text;
    const correctedText = applyQuestionPunctuationIntent(nativeText);
    const punctuationChanged = correctedText !== nativeText;
    const didChange = correctedText !== text;
    const reason = punctuationChanged
      ? nativeResult.didChange
        ? "native-correction-question-punctuation"
        : "question-punctuation"
      : nativeResult.reason ?? (nativeResult.didChange ? "native-correction" : "unchanged");

    return {
      text: correctedText,
      debug: {
        supported: nativeResult.supported,
        originalText: text,
        correctedText: didChange ? correctedText : nativeText,
        didChange,
        reason,
        wordCount: nativeResult.wordCount || wordCount,
        replacementCount: nativeResult.replacementCount,
        error: nativeResult.error ?? null,
      },
    };
  } catch (error) {
    const punctuationText = applyQuestionPunctuationIntent(text);
    return {
      text: punctuationText,
      debug: {
        supported: null,
        originalText: text,
        correctedText: punctuationText,
        didChange: punctuationText !== text,
        reason: punctuationText !== text ? "question-punctuation" : "fallback-original",
        wordCount,
        replacementCount: 0,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

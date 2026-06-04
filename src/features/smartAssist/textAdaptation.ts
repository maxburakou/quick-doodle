const STORAGE_KEY = "quickDoodle.smartAssistTextAdaptation";
const MAX_PHRASE_COUNT = 160;
const MAX_CORRECTION_COUNT = 240;

interface TextAdaptationState {
  corrections: Record<string, Record<string, number>>;
  phrases: Record<string, number>;
  words: Record<string, number>;
}

const emptyState = (): TextAdaptationState => ({
  corrections: {},
  phrases: {},
  words: {},
});

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

const normalizeText = (text: string) =>
  text.trim().replace(/\s+/g, " ").toLowerCase();

const getWords = (text: string) =>
  normalizeText(text).match(/[a-z0-9][a-z0-9._/-]*/g) ?? [];

const levenshtein = (a: string, b: string) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) dp[row][0] = row;
  for (let col = 0; col < cols; col += 1) dp[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      dp[row][col] = Math.min(
        dp[row - 1][col] + 1,
        dp[row][col - 1] + 1,
        dp[row - 1][col - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
};

const increment = (values: Record<string, number>, key: string, amount = 1) => {
  values[key] = (values[key] ?? 0) + amount;
};

const trimRecord = (values: Record<string, number>, maxCount: number) =>
  Object.fromEntries(
    Object.entries(values)
      .sort((left, right) => right[1] - left[1])
      .slice(0, maxCount)
  );

export const getTextAdaptationState = (): TextAdaptationState => {
  if (!canUseStorage()) return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TextAdaptationState>;
    return {
      corrections: parsed.corrections ?? {},
      phrases: parsed.phrases ?? {},
      words: parsed.words ?? {},
    };
  } catch {
    return emptyState();
  }
};

const saveTextAdaptationState = (state: TextAdaptationState) => {
  if (!canUseStorage()) return;

  const trimmedCorrections = Object.fromEntries(
    Object.entries(state.corrections)
      .sort((left, right) => {
        const leftBest = Math.max(...Object.values(left[1]));
        const rightBest = Math.max(...Object.values(right[1]));
        return rightBest - leftBest;
      })
      .slice(0, MAX_CORRECTION_COUNT)
  );

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        corrections: trimmedCorrections,
        phrases: trimRecord(state.phrases, MAX_PHRASE_COUNT),
        words: trimRecord(state.words, MAX_PHRASE_COUNT * 4),
      })
    );
  } catch {
    // Adaptation is opportunistic; storage failures should not affect recognition.
  }
};

export const learnTextRecognitionCorrection = (
  rawText: string,
  finalText: string,
  expectedText: string
) => {
  const expected = normalizeText(expectedText);
  if (!expected) return;

  const raw = normalizeText(rawText);
  const final = normalizeText(finalText);
  const state = getTextAdaptationState();

  increment(state.phrases, expected);
  getWords(expected).forEach((word) => increment(state.words, word));

  [raw, final].filter(Boolean).forEach((source) => {
    if (source === expected) return;
    state.corrections[source] = state.corrections[source] ?? {};
    increment(state.corrections[source], expected);
  });

  saveTextAdaptationState(state);
};

export const learnTextRecognitionPhrase = (text: string) => {
  const expected = normalizeText(text);
  if (!expected) return;

  const state = getTextAdaptationState();
  increment(state.phrases, expected);
  getWords(expected).forEach((word) => increment(state.words, word));
  saveTextAdaptationState(state);
};

export const getPersonalTextCandidates = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const state = getTextAdaptationState();
  const exactCorrections = Object.entries(state.corrections[normalized] ?? {})
    .sort((left, right) => right[1] - left[1])
    .map(([candidate]) => candidate);

  const maxDistance = Math.max(1, Math.ceil(normalized.length * 0.34));
  const nearbyPhrases = Object.entries(state.phrases)
    .map(([phrase, count]) => ({
      count,
      distance: levenshtein(normalized, phrase),
      phrase,
    }))
    .filter(({ distance, phrase }) => {
      if (phrase === normalized) return false;
      if (Math.abs(phrase.length - normalized.length) > maxDistance) return false;
      return distance <= maxDistance;
    })
    .sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance;
      return right.count - left.count;
    })
    .map(({ phrase }) => phrase);

  return [...new Set([...exactCorrections, ...nearbyPhrases])].slice(0, 5);
};

export const scorePersonalTextCandidate = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return 0;

  const state = getTextAdaptationState();
  const phraseScore = Math.min(1.4, (state.phrases[normalized] ?? 0) * 0.35);
  const wordScore = Math.min(
    0.75,
    getWords(normalized).reduce(
      (sum, word) => sum + Math.min(0.18, (state.words[word] ?? 0) * 0.045),
      0
    )
  );
  return phraseScore + wordScore;
};

export const clearTextAdaptationState = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const exportTextAdaptationState = () =>
  JSON.stringify(getTextAdaptationState(), null, 2);

export const SMART_ASSIST_TEXT_ADAPTATION_KEY = STORAGE_KEY;

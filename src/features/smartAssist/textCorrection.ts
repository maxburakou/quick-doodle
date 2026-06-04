import { invoke } from "@tauri-apps/api/core";
import { logSmartAssistDebug } from "./debug";
import {
  LANGUAGE_BIGRAM_RANK,
  LANGUAGE_BIGRAMS,
  LANGUAGE_WORD_RANK,
  LANGUAGE_WORDS,
  getKnownWordRank,
  isKnownDomainWord,
  isKnownLanguageWord,
  scoreTextLanguageCandidate,
} from "./textLanguageModel";

interface SpellSuggestionResult {
  correction: string | null;
  guesses: string[];
  valid: boolean;
}

const WORD_PATTERN = /^[A-Za-z]{3,}$/;
const WORD_FRAGMENT_PATTERN = /[A-Za-z]+|[^A-Za-z]+/g;
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

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

const preserveTokenCase = (source: string, target: string) => {
  if (source.toUpperCase() === source) return target.toUpperCase();
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target.toLowerCase();
};

const isVowel = (char: string) => VOWELS.has(char.toLowerCase());

const charClassMismatchCount = (source: string, candidate: string) => {
  const length = Math.min(source.length, candidate.length);
  let mismatchCount = Math.abs(source.length - candidate.length);

  for (let index = 0; index < length; index += 1) {
    const sourceChar = source[index].toLowerCase();
    const candidateChar = candidate[index].toLowerCase();
    if (!/[a-z]/.test(sourceChar) || !/[a-z]/.test(candidateChar)) continue;
    if (isVowel(sourceChar) !== isVowel(candidateChar)) mismatchCount += 1;
  }

  return mismatchCount;
};

const getCommonWordCandidates = (token: string) => {
  const normalizedToken = token.toLowerCase();
  const maxDistance = Math.max(2, Math.ceil(token.length * 0.45));

  return LANGUAGE_WORDS.filter((word) => {
    if (Math.abs(word.length - normalizedToken.length) > maxDistance) return false;
    return levenshtein(normalizedToken, word) <= maxDistance;
  });
};

const getTokenAlternatives = (token: string, alternatives: string[]) => {
  const normalizedToken = token.toLowerCase();
  const maxDistance = Math.max(2, Math.ceil(token.length * 0.45));

  return alternatives
    .map((alternative) => alternative.trim())
    .filter((alternative) => WORD_PATTERN.test(alternative))
    .filter((alternative) => {
      const normalizedAlternative = alternative.toLowerCase();
      if (normalizedAlternative === normalizedToken) return false;
      return levenshtein(normalizedToken, normalizedAlternative) <= maxDistance;
    });
};

const isKnownWordCandidate = (
  candidate: string,
  suggestionResult: SpellSuggestionResult,
  alternativeCandidates: string[]
) => {
  const normalizedCandidate = candidate.toLowerCase();
  return (
    LANGUAGE_WORD_RANK.has(normalizedCandidate) ||
    alternativeCandidates.includes(candidate) ||
    suggestionResult.correction === candidate ||
    suggestionResult.guesses.includes(candidate)
  );
};

const chooseBestSuggestion = (
  token: string,
  suggestionResult: SpellSuggestionResult,
  modelAlternatives: string[]
) => {
  if (isKnownDomainWord(token)) return token;
  if (suggestionResult.valid) return token;

  const normalizedToken = token.toLowerCase();
  const alternativeCandidates = getTokenAlternatives(token, modelAlternatives);
  const commonCandidates = getCommonWordCandidates(token);
  const candidates = unique([
    ...alternativeCandidates,
    suggestionResult.correction ?? "",
    ...suggestionResult.guesses,
    ...commonCandidates,
  ]);

  if (candidates.length === 0) return token;

  const ranked = candidates
    .map((candidate, index) => {
      const normalizedCandidate = candidate.toLowerCase();
      const distance = levenshtein(normalizedToken, normalizedCandidate);
      const classMismatchCount = charClassMismatchCount(
        normalizedToken,
        normalizedCandidate
      );
      const commonRank = getKnownWordRank(normalizedCandidate);
      const commonBonus = commonRank > 0 ? Math.min(1.25, commonRank / 80) : 0;
      const domainBonus = isKnownDomainWord(normalizedCandidate) ? 0.85 : 0;
      const modelBonus = alternativeCandidates.includes(candidate) ? 0.45 : 0;
      const spellBonus =
        suggestionResult.correction === candidate
          ? 0.5
          : suggestionResult.guesses.includes(candidate)
            ? 0.22
            : 0;
      const score =
        distance +
        classMismatchCount * 0.35 +
        index * 0.12 +
        0.08 -
        commonBonus -
        domainBonus -
        modelBonus -
        spellBonus;

      return {
        candidate,
        distance,
        classMismatchCount,
        score,
      };
    })
    .sort((left, right) => left.score - right.score);

  const best = ranked[0];
  if (!best) return token;

  const maxAcceptedDistance = Math.max(2, Math.ceil(token.length * 0.45));

  if (
    best.distance > maxAcceptedDistance ||
    !isKnownWordCandidate(best.candidate, suggestionResult, alternativeCandidates)
  ) {
    return token;
  }

  return preserveTokenCase(token, best.candidate);
};

const correctToken = async (
  token: string,
  alternatives: string[]
): Promise<string> => {
  if (!WORD_PATTERN.test(token)) return token;
  if (isKnownDomainWord(token) || isKnownLanguageWord(token)) return token;

  try {
    const suggestionResult = await invoke<SpellSuggestionResult>(
      "smart_assist_spell_suggest",
      {
        word: token,
      }
    );

    const corrected = chooseBestSuggestion(token, suggestionResult, alternatives);
    if (corrected !== token) {
      logSmartAssistDebug("spell-corrected recognized token", {
        token,
        corrected,
        correction: suggestionResult.correction,
        guesses: suggestionResult.guesses,
        alternatives,
      });
    }

    return corrected;
  } catch (error) {
    logSmartAssistDebug("spell correction failed", {
      token,
      error: error instanceof Error ? error.message : String(error),
    });
    return token;
  }
};

const splitTextFragments = (value: string) =>
  value.match(WORD_FRAGMENT_PATTERN) ?? [];

const getSegmentAlternatives = (
  segment: string,
  segmentIndex: number,
  alternatives: string[],
  textIsSingleToken: boolean
) => {
  if (!WORD_PATTERN.test(segment)) return [];

  if (textIsSingleToken) return alternatives;

  return alternatives
    .map((alternative) => splitTextFragments(alternative)[segmentIndex])
    .filter((alternative): alternative is string => Boolean(alternative));
};

const maxContextDistance = (word: string) =>
  Math.max(1, Math.ceil(word.length * 0.42));

const getBigramCandidateScore = (
  currentLeft: string,
  currentRight: string,
  targetLeft: string,
  targetRight: string
) => {
  const leftDistance = levenshtein(currentLeft, targetLeft);
  const rightDistance = levenshtein(currentRight, targetRight);
  if (
    leftDistance > maxContextDistance(targetLeft) ||
    rightDistance > maxContextDistance(targetRight)
  ) {
    return null;
  }

  const leftClassMismatch = charClassMismatchCount(currentLeft, targetLeft);
  const rightClassMismatch = charClassMismatchCount(currentRight, targetRight);
  const bigramRank = LANGUAGE_BIGRAM_RANK.get(`${targetLeft} ${targetRight}`) ?? 0;
  const bigramBonus = bigramRank > 0 ? Math.min(0.8, bigramRank / 34) : 0;

  return (
    leftDistance +
    rightDistance +
    (leftClassMismatch + rightClassMismatch) * 0.28 -
    bigramBonus
  );
};

const applyContextCorrections = (
  rawSegments: string[],
  correctedSegments: string[]
) => {
  const nextSegments = [...correctedSegments];
  const wordSegmentIndexes = rawSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => WORD_PATTERN.test(segment))
    .map(({ index }) => index);

  for (let position = 1; position < wordSegmentIndexes.length; position += 1) {
    const leftIndex = wordSegmentIndexes[position - 1];
    const rightIndex = wordSegmentIndexes[position];
    const currentLeft = nextSegments[leftIndex].toLowerCase();
    const currentRight = nextSegments[rightIndex].toLowerCase();
    const currentBigram = `${currentLeft} ${currentRight}`;
    if (LANGUAGE_BIGRAM_RANK.has(currentBigram)) continue;

    const best = LANGUAGE_BIGRAMS.map((bigram) => {
      const [targetLeft, targetRight] = bigram.split(" ");
      const score = getBigramCandidateScore(
        currentLeft,
        currentRight,
        targetLeft,
        targetRight
      );
      return score === null ? null : { targetLeft, targetRight, score };
    })
      .filter(
        (
          candidate
        ): candidate is {
          targetLeft: string;
          targetRight: string;
          score: number;
        } => candidate !== null
      )
      .sort((left, right) => left.score - right.score)[0];

    if (!best || best.score > 2.55) continue;

    const nextLeft = preserveTokenCase(nextSegments[leftIndex], best.targetLeft);
    const nextRight = preserveTokenCase(nextSegments[rightIndex], best.targetRight);
    if (
      nextLeft.toLowerCase() === currentLeft &&
      nextRight.toLowerCase() === currentRight
    ) {
      continue;
    }

    logSmartAssistDebug("context-corrected recognized text pair", {
      before: `${nextSegments[leftIndex]} ${nextSegments[rightIndex]}`,
      after: `${nextLeft} ${nextRight}`,
      score: best.score,
    });
    nextSegments[leftIndex] = nextLeft;
    nextSegments[rightIndex] = nextRight;
  }

  return nextSegments;
};

export const correctRecognizedText = async (
  text: string,
  alternatives: string[] = []
): Promise<string> => {
  const segments = splitTextFragments(text);
  const textIsSingleToken = !/\s/.test(text);
  const correctedSegments = await Promise.all(
    segments.map((segment, index) =>
      correctToken(
        segment,
        getSegmentAlternatives(segment, index, alternatives, textIsSingleToken)
      )
    )
  );

  const contextCorrectedSegments = applyContextCorrections(
    segments,
    correctedSegments
  );
  const correctedText = contextCorrectedSegments.join("");
  const bestAlternative = unique([correctedText, ...alternatives])
    .map((candidate, index) => ({
      candidate,
      score: scoreTextLanguageCandidate(candidate) - index * 0.35,
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? correctedText;

  if (bestAlternative !== text) {
    logSmartAssistDebug("corrected recognized text", {
      raw: text,
      corrected: bestAlternative,
      alternatives,
    });
  }

  return bestAlternative;
};

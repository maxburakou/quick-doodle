import { invoke } from "@tauri-apps/api/core";
import {
  getDeveloperPhraseScore,
  getDeveloperTokenCandidates,
  getDeveloperWordRank,
  isKnownDeveloperWord,
} from "./developerLexicon";
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
import { TextRecognitionCandidate } from "./textRecognition";

interface SpellSuggestionResult {
  correction: string | null;
  guesses: string[];
  valid: boolean;
}

interface SpellTokenAnalysis extends SpellSuggestionResult {
  completions: string[];
  token: string;
}

interface SpellCandidateAnalysis {
  candidate: string;
  misspelled_count: number;
  valid: boolean;
}

interface SpellAnalyzeResult {
  candidates: SpellCandidateAnalysis[];
  tokens: SpellTokenAnalysis[];
}

const WORD_PATTERN = /^[A-Za-z]{3,}$/;
const CODE_TOKEN_PATTERN = /^\.?[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+)*$/;
const WORD_FRAGMENT_PATTERN =
  /\.?[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+)*|[^A-Za-z]+/g;
const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const SPELL_ANALYSIS_CANDIDATE_LIMIT = 8;
const SPELL_ANALYSIS_TOKEN_LIMIT = 24;
const SPELL_ANALYSIS_CACHE_LIMIT = 256;

const spellAnalysisCache = new Map<string, SpellAnalyzeResult>();

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

const getMaxAcceptedCorrectionDistance = (token: string) =>
  Math.max(2, Math.ceil(token.length * 0.45));

const isStrongSpellCorrection = (token: string, correction: string | null) => {
  if (!correction || !WORD_PATTERN.test(correction)) return false;

  const normalizedToken = token.toLowerCase();
  const normalizedCorrection = correction.toLowerCase();
  if (normalizedCorrection === normalizedToken) return false;

  const distance = levenshtein(normalizedToken, normalizedCorrection);
  if (distance > getMaxAcceptedCorrectionDistance(token)) return false;

  const knownCorrection =
    isKnownLanguageWord(normalizedCorrection) ||
    isKnownDomainWord(normalizedCorrection);
  const conservativeDistance = Math.max(2, Math.ceil(token.length * 0.28));

  return knownCorrection || distance <= conservativeDistance;
};

const normalizeRecognitionCandidates = (
  alternatives: string[] | TextRecognitionCandidate[]
): TextRecognitionCandidate[] =>
  alternatives.map((alternative, index) => {
    if (typeof alternative === "string") {
      return {
        text: alternative,
        source: "beam",
        totalScore: -index,
      };
    }
    return alternative;
  });

const getCandidateTexts = (
  text: string,
  candidates: TextRecognitionCandidate[]
) =>
  unique([text, ...candidates.map((candidate) => candidate.text.trim())])
    .filter(Boolean)
    .slice(0, SPELL_ANALYSIS_CANDIDATE_LIMIT);

const shouldAskNativeSpellChecker = (token: string) => {
  if (!WORD_PATTERN.test(token)) return false;
  if (isKnownDomainWord(token) || isKnownDeveloperWord(token)) return false;
  return true;
};

const getSpellAnalysisCacheKey = (candidateTexts: string[], tokens: string[]) =>
  JSON.stringify({
    candidates: candidateTexts.map((candidate) => candidate.toLowerCase()),
    tokens: tokens.map((token) => token.toLowerCase()),
  });

const cacheSpellAnalysis = (key: string, result: SpellAnalyzeResult) => {
  spellAnalysisCache.set(key, result);
  if (spellAnalysisCache.size <= SPELL_ANALYSIS_CACHE_LIMIT) return;

  const firstKey = spellAnalysisCache.keys().next().value;
  if (firstKey) spellAnalysisCache.delete(firstKey);
};

const analyzeSpelling = async (
  candidateTexts: string[],
  tokens: string[]
): Promise<SpellAnalyzeResult> => {
  const key = getSpellAnalysisCacheKey(candidateTexts, tokens);
  const cached = spellAnalysisCache.get(key);
  if (cached) return cached;

  try {
    const result = await invoke<SpellAnalyzeResult>("smart_assist_spell_analyze", {
      request: {
        candidates: candidateTexts,
        tokens,
      },
    });
    cacheSpellAnalysis(key, result);
    return result;
  } catch {
    const fallback = {
      candidates: candidateTexts.map((candidate) => ({
        candidate,
        misspelled_count: 0,
        valid: false,
      })),
      tokens: [],
    };
    cacheSpellAnalysis(key, fallback);
    return fallback;
  }
};

const getTokenAnalysisMap = (analysis: SpellAnalyzeResult) =>
  new Map(analysis.tokens.map((token) => [token.token.toLowerCase(), token]));

const getCandidateAnalysisMap = (analysis: SpellAnalyzeResult) =>
  new Map(
    analysis.candidates.map((candidate) => [
      candidate.candidate,
      candidate,
    ])
  );

const getCommonWordCandidates = (token: string) => {
  const normalizedToken = token.toLowerCase();
  const maxDistance = getMaxAcceptedCorrectionDistance(token);

  return LANGUAGE_WORDS.filter((word) => {
    if (Math.abs(word.length - normalizedToken.length) > maxDistance) return false;
    return levenshtein(normalizedToken, word) <= maxDistance;
  });
};

const getTokenAlternatives = (
  token: string,
  alternatives: TextRecognitionCandidate[]
) => {
  const normalizedToken = token.toLowerCase();
  const maxDistance = getMaxAcceptedCorrectionDistance(token);

  return alternatives
    .map((alternative) => alternative.text.trim())
    .filter(
      (alternative) =>
        WORD_PATTERN.test(alternative) || CODE_TOKEN_PATTERN.test(alternative)
    )
    .filter((alternative) => {
      const normalizedAlternative = alternative.toLowerCase();
      if (normalizedAlternative === normalizedToken) return false;
      return levenshtein(normalizedToken, normalizedAlternative) <= maxDistance;
    });
};

const isKnownWordCandidate = (
  candidate: string,
  suggestionResult: SpellTokenAnalysis | SpellSuggestionResult,
  alternativeCandidates: string[]
) => {
  const normalizedCandidate = candidate.toLowerCase();
  return (
    LANGUAGE_WORD_RANK.has(normalizedCandidate) ||
    isKnownDeveloperWord(normalizedCandidate) ||
    alternativeCandidates.includes(candidate) ||
    suggestionResult.correction === candidate ||
    suggestionResult.guesses.includes(candidate) ||
    ("completions" in suggestionResult &&
      suggestionResult.completions.includes(candidate))
  );
};

const chooseBestSuggestion = (
  token: string,
  suggestionResult: SpellTokenAnalysis | SpellSuggestionResult,
  modelAlternatives: TextRecognitionCandidate[]
) => {
  if (isKnownDomainWord(token) || isKnownDeveloperWord(token)) return token;
  if (suggestionResult.valid) return token;
  if (isStrongSpellCorrection(token, suggestionResult.correction)) {
    return preserveTokenCase(token, suggestionResult.correction!);
  }

  const normalizedToken = token.toLowerCase();
  const alternativeCandidates = getTokenAlternatives(token, modelAlternatives);
  const developerCandidates = getDeveloperTokenCandidates(token);
  const commonCandidates = getCommonWordCandidates(token);
  const candidates = unique([
    ...developerCandidates,
    ...alternativeCandidates,
    suggestionResult.correction ?? "",
    ...suggestionResult.guesses,
    ...("completions" in suggestionResult ? suggestionResult.completions : []),
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
      const developerRank = getDeveloperWordRank(normalizedCandidate);
      const developerBonus =
        developerRank > 0 ? 1.25 + Math.min(0.95, developerRank / 130) : 0;
      const domainBonus = isKnownDomainWord(normalizedCandidate) ? 0.85 : 0;
      const modelBonus = alternativeCandidates.includes(candidate) ? 0.45 : 0;
      const spellBonus =
        suggestionResult.correction === candidate
          ? 0.5
          : suggestionResult.guesses.includes(candidate)
            ? 0.22
            : "completions" in suggestionResult &&
                suggestionResult.completions.includes(candidate)
              ? 0.16
            : 0;
      const score =
        distance +
        classMismatchCount * 0.35 +
        index * 0.12 +
        0.08 -
        developerBonus -
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

  const maxAcceptedDistance = getMaxAcceptedCorrectionDistance(token);

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
  alternatives: TextRecognitionCandidate[],
  tokenAnalysis: SpellTokenAnalysis | null
): Promise<string> => {
  if (!WORD_PATTERN.test(token) && !CODE_TOKEN_PATTERN.test(token)) return token;
  if (
    isKnownDomainWord(token) ||
    isKnownDeveloperWord(token) ||
    isKnownLanguageWord(token)
  ) {
    return token;
  }

  const normalizedCodeToken = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedCodeToken.length <= 2) return token;

  const developerCandidates = getDeveloperTokenCandidates(token);
  if (developerCandidates.length > 0) {
    const bestDeveloperCandidate = developerCandidates[0];
    const developerDistance = levenshtein(
      normalizedCodeToken,
      bestDeveloperCandidate.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    if (developerDistance <= Math.max(1, Math.ceil(token.length * 0.22))) {
      return preserveTokenCase(token, bestDeveloperCandidate);
    }
  }

  if (!WORD_PATTERN.test(token)) return token;

  try {
    const suggestionResult =
      tokenAnalysis ??
      (await invoke<SpellSuggestionResult>("smart_assist_spell_suggest", {
        word: token,
      }));

    return chooseBestSuggestion(token, suggestionResult, alternatives);
  } catch {
    return token;
  }
};

const splitTextFragments = (value: string) =>
  value.match(WORD_FRAGMENT_PATTERN) ?? [];

const getSegmentAlternatives = (
  segment: string,
  segmentIndex: number,
  alternatives: TextRecognitionCandidate[],
  textIsSingleToken: boolean
) => {
  if (!WORD_PATTERN.test(segment) && !CODE_TOKEN_PATTERN.test(segment)) return [];

  if (textIsSingleToken) return alternatives;

  return alternatives
    .map((alternative) => ({
      ...alternative,
      text: splitTextFragments(alternative.text)[segmentIndex] ?? "",
    }))
    .filter((alternative) => Boolean(alternative.text));
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
    .filter(
      ({ segment }) =>
        WORD_PATTERN.test(segment) || CODE_TOKEN_PATTERN.test(segment)
    )
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

    nextSegments[leftIndex] = nextLeft;
    nextSegments[rightIndex] = nextRight;
  }

  return nextSegments;
};

export const correctRecognizedText = async (
  text: string,
  alternatives: string[] | TextRecognitionCandidate[] = []
): Promise<string> => {
  const candidates = normalizeRecognitionCandidates(alternatives);
  const candidateTexts = getCandidateTexts(text, candidates);
  const segments = splitTextFragments(text);
  const spellTokens = unique(segments.filter(shouldAskNativeSpellChecker)).slice(
    0,
    SPELL_ANALYSIS_TOKEN_LIMIT
  );
  const spellAnalysis = await analyzeSpelling(candidateTexts, spellTokens);
  const tokenAnalysisByToken = getTokenAnalysisMap(spellAnalysis);
  const candidateAnalysisByText = getCandidateAnalysisMap(spellAnalysis);
  const textIsSingleToken = !/\s/.test(text);
  const correctedSegments = await Promise.all(
    segments.map((segment, index) =>
      correctToken(
        segment,
        getSegmentAlternatives(segment, index, candidates, textIsSingleToken),
        tokenAnalysisByToken.get(segment.toLowerCase()) ?? null
      )
    )
  );

  const contextCorrectedSegments = applyContextCorrections(
    segments,
    correctedSegments
  );
  const correctedText = contextCorrectedSegments.join("");
  if (correctedText !== text) {
    return correctedText;
  }

  const scoreByCandidate = new Map(
    candidates.map((candidate, index) => [
      candidate.text,
      Math.max(0, candidates.length - index) * 0.12 +
        (candidate.source === "greedy" ? 0.08 : 0),
    ])
  );
  const bestAlternative = unique([
    correctedText,
    ...candidates.map((candidate) => candidate.text),
  ])
    .map((candidate, index) => ({
      candidate,
      score: (() => {
        const spellCandidate = candidateAnalysisByText.get(candidate);
        const spellPhraseScore = spellCandidate
          ? (spellCandidate.valid ? 0.7 : 0) -
            spellCandidate.misspelled_count * 0.42
          : 0;
        return (
          scoreTextLanguageCandidate(candidate) +
          getDeveloperPhraseScore(candidate) * 0.45 +
          spellPhraseScore +
          (scoreByCandidate.get(candidate) ?? 0) -
          index * 0.35
        );
      })(),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? correctedText;

  return bestAlternative;
};

import {
  IT_DOMAIN_WORD_RANK,
  LANGUAGE_BIGRAM_RANK,
  LANGUAGE_WORD_RANK,
  getDeveloperPhraseScore,
  getDeveloperWordScore,
  hasDeveloperWordPrefix,
  hasLanguageWordPrefix,
  isKnownDomainWord,
  isKnownDeveloperWord,
  isKnownLanguageWord,
} from "./textLexicon";

const WORD_TOKEN_PATTERN = /[A-Za-z][A-Za-z0-9]*/g;
const CODE_LIKE_TEXT_PATTERN = /[._/-]|[a-z][A-Z]|[A-Z]{2,}/;
const PUNCTUATION_ONLY_PATTERN = /^[!'",.;:?]+$/;
const STANDALONE_PUNCTUATION_PATTERN = /^[!?,.:;]$/;
const TRAILING_PUNCTUATION_PATTERN = /[!?,.:;]$/;
const WORD_TRAILING_PUNCTUATION_PATTERN = /\b[A-Za-z][A-Za-z0-9]*[!?,.:;]$/;
const EMPHATIC_TRAILING_PUNCTUATION_PATTERN = /\b[A-Za-z][A-Za-z0-9]*[!?]{2,3}$/;
const COMMON_WORD_BASE_SCORE = 0.42;
const COMMON_WORD_MAX_RANK_BONUS = 0.88;
const COMMON_WORD_RANK_DIVISOR = 72;
const COMMON_DOMAIN_BONUS = 0.24;
const DEVELOPER_SINGLE_WORD_WEIGHT = 0.34;
const DEVELOPER_SINGLE_WORD_MAX_SCORE = 0.58;
const DEVELOPER_CONTEXT_WEIGHT = 0.42;
const DEVELOPER_CODE_STYLE_WEIGHT = 0.18;

const getWords = (text: string) =>
  [...text.matchAll(WORD_TOKEN_PATTERN)].map((match) =>
    match[0].toLowerCase()
  );

const getCompletedWords = (text: string, prefixMode: boolean) => {
  const words = getWords(text);
  if (
    !prefixMode ||
    /\s$/.test(text) ||
    TRAILING_PUNCTUATION_PATTERN.test(text.trim()) ||
    words.length === 0
  ) {
    return words;
  }
  return words.slice(0, -1);
};

const getLastWord = (text: string) => {
  const match = text.match(/[A-Za-z][A-Za-z0-9]*$/);
  return match ? match[0].toLowerCase() : "";
};

const getWordScore = (word: string) => {
  const rank = LANGUAGE_WORD_RANK.get(word) ?? 0;
  if (rank === 0) {
    if (!isKnownDeveloperWord(word)) return -0.18;
    return Math.min(
      DEVELOPER_SINGLE_WORD_MAX_SCORE,
      getDeveloperWordScore(word) * DEVELOPER_SINGLE_WORD_WEIGHT
    );
  }

  const commonBonus =
    COMMON_WORD_BASE_SCORE +
    Math.min(COMMON_WORD_MAX_RANK_BONUS, rank / COMMON_WORD_RANK_DIVISOR);
  const domainBonus = IT_DOMAIN_WORD_RANK.has(word) ? COMMON_DOMAIN_BONUS : 0;
  return commonBonus + domainBonus;
};

const LANGUAGE_PATTERN_BONUSES = [
  { pattern: /\bhttps?:\/\//, score: 1.8 },
  { pattern: /\bapi[./: ]/, score: 0.45 },
  {
    pattern: /\b(get|post|put|patch|delete)\s+(request|response|api|url|endpoint)\b/,
    score: 0.7,
  },
  { pattern: /\b(request|response)\s+(body|payload|data|json)\b/, score: 0.55 },
] as const;

const getPhrasePatternScore = (text: string) => {
  const normalized = text.toLowerCase();
  const patternScore = LANGUAGE_PATTERN_BONUSES.reduce(
    (sum, bonus) => sum + (bonus.pattern.test(normalized) ? bonus.score : 0),
    0
  );
  const words = getWords(text);
  const developerWeight =
    words.length > 1
      ? DEVELOPER_CONTEXT_WEIGHT
      : CODE_LIKE_TEXT_PATTERN.test(text)
        ? DEVELOPER_CODE_STYLE_WEIGHT
        : 0;

  return patternScore + getDeveloperPhraseScore(text) * developerWeight;
};

const getJoinedWordPenalty = (text: string) => {
  const longRuns = text.toLowerCase().match(/[a-z]{10,}/g) ?? [];

  return longRuns.reduce((penalty, run) => {
    if (isKnownLanguageWord(run) || isKnownDeveloperWord(run)) return penalty;
    return penalty + Math.min(2.2, 0.22 * (run.length - 8));
  }, 0);
};

const getPunctuationScore = (text: string) => {
  const normalized = text.trim();
  if (!PUNCTUATION_ONLY_PATTERN.test(normalized)) return 0;
  if (STANDALONE_PUNCTUATION_PATTERN.test(normalized)) return 0.54;
  if (/^[!?]{2,3}$/.test(normalized) || normalized === "...") return 0.42;
  return 0.16;
};

const getTrailingPunctuationScore = (text: string) => {
  const normalized = text.trim();
  if (EMPHATIC_TRAILING_PUNCTUATION_PATTERN.test(normalized)) return 0.46;
  if (WORD_TRAILING_PUNCTUATION_PATTERN.test(normalized)) return 0.36;
  return 0;
};

export const scoreTextLanguageCandidate = (
  text: string,
  options: { prefixMode?: boolean } = {}
) => {
  const prefixMode = options.prefixMode ?? false;
  const completedWords = getCompletedWords(text, prefixMode);
  let score = completedWords.reduce((sum, word) => sum + getWordScore(word), 0);

  for (let index = 1; index < completedWords.length; index += 1) {
    const bigram = `${completedWords[index - 1]} ${completedWords[index]}`;
    const rank = LANGUAGE_BIGRAM_RANK.get(bigram) ?? 0;
    if (rank > 0) score += 0.7 + Math.min(0.45, rank / 120);
  }

  if (completedWords.length > 1) {
    score += Math.min(0.45, (completedWords.length - 1) * 0.08);
  }

  if (prefixMode) {
    const lastWord = getLastWord(text);
    if (lastWord) {
      if (isKnownLanguageWord(lastWord)) {
        score += getWordScore(lastWord) * 0.75;
      } else if (hasLanguageWordPrefix(lastWord)) {
        score += 0.22;
      } else if (isKnownDomainWord(lastWord) || hasDeveloperWordPrefix(lastWord)) {
        score += 0.16;
      }
    }
  }

  score += getPhrasePatternScore(text);
  score += getPunctuationScore(text);
  score += getTrailingPunctuationScore(text);
  score -= getJoinedWordPenalty(text);

  if (/ {2,}/.test(text)) score -= 0.7;
  if (!PUNCTUATION_ONLY_PATTERN.test(text.trim()) && /^[!'",.;:?]/.test(text)) {
    score -= 0.35;
  }
  if (/[A-Za-z]{18,}/.test(text)) score -= 0.95;

  return score;
};

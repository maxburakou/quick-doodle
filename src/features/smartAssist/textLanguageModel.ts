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

const getWords = (text: string) =>
  [...text.matchAll(WORD_TOKEN_PATTERN)].map((match) =>
    match[0].toLowerCase()
  );

const getCompletedWords = (text: string, prefixMode: boolean) => {
  const words = getWords(text);
  if (!prefixMode || /\s$/.test(text) || words.length === 0) return words;
  return words.slice(0, -1);
};

const getLastWord = (text: string) => {
  const match = text.match(/[A-Za-z][A-Za-z0-9]*$/);
  return match ? match[0].toLowerCase() : "";
};

const getWordScore = (word: string) => {
  const rank = LANGUAGE_WORD_RANK.get(word) ?? 0;
  if (rank === 0) return isKnownDeveloperWord(word) ? getDeveloperWordScore(word) : -0.18;

  const commonBonus = Math.min(0.9, rank / 150);
  const domainBonus = IT_DOMAIN_WORD_RANK.has(word) ? 0.65 : 0;
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

  return patternScore + getDeveloperPhraseScore(text) * 0.55;
};

const getJoinedWordPenalty = (text: string) => {
  const longRuns = text.toLowerCase().match(/[a-z]{10,}/g) ?? [];

  return longRuns.reduce((penalty, run) => {
    if (isKnownLanguageWord(run) || isKnownDeveloperWord(run)) return penalty;
    return penalty + Math.min(2.2, 0.22 * (run.length - 8));
  }, 0);
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
      } else if (hasLanguageWordPrefix(lastWord) || hasDeveloperWordPrefix(lastWord)) {
        score += isKnownDomainWord(lastWord) || hasDeveloperWordPrefix(lastWord) ? 0.45 : 0.22;
      }
    }
  }

  score += getPhrasePatternScore(text);
  score -= getJoinedWordPenalty(text);

  if (/ {2,}/.test(text)) score -= 0.7;
  if (/^[!'",.;:?]/.test(text)) score -= 0.35;
  if (/[A-Za-z]{18,}/.test(text)) score -= 0.95;

  return score;
};

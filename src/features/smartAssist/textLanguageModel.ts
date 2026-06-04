import {
  DEVELOPER_BIGRAMS,
  DEVELOPER_WORDS,
  getDeveloperPhraseScore,
  getDeveloperWordScore,
  hasDeveloperWordPrefix,
  isKnownDeveloperWord,
} from "./developerLexicon";

const BASE_COMMON_WORDS = [
  "the",
  "and",
  "you",
  "that",
  "was",
  "for",
  "are",
  "with",
  "his",
  "they",
  "this",
  "have",
  "from",
  "one",
  "had",
  "word",
  "but",
  "not",
  "what",
  "all",
  "were",
  "when",
  "your",
  "can",
  "said",
  "there",
  "use",
  "each",
  "which",
  "she",
  "how",
  "their",
  "will",
  "other",
  "about",
  "out",
  "many",
  "then",
  "them",
  "these",
  "some",
  "her",
  "would",
  "make",
  "like",
  "him",
  "into",
  "time",
  "has",
  "look",
  "two",
  "more",
  "write",
  "see",
  "number",
  "way",
  "could",
  "people",
  "than",
  "first",
  "water",
  "been",
  "call",
  "who",
  "oil",
  "now",
  "find",
  "long",
  "down",
  "day",
  "did",
  "get",
  "come",
  "made",
  "may",
  "part",
  "hello",
  "world",
  "test",
  "text",
  "quick",
  "note",
  "todo",
  "draw",
  "line",
  "shape",
  "thing",
  "right",
  "left",
  "good",
  "bad",
  "yes",
  "please",
  "thanks",
  "work",
  "home",
  "app",
  "code",
  "fix",
  "done",
  "start",
  "stop",
  "open",
  "close",
  "save",
  "copy",
  "move",
  "idea",
  "plan",
  "next",
  "back",
  "new",
  "old",
  "big",
  "small",
  "same",
  "real",
  "true",
  "false",
  "why",
  "where",
  "need",
  "needs",
  "should",
  "must",
  "create",
  "update",
  "delete",
  "read",
  "write",
  "load",
  "send",
  "receive",
  "build",
  "run",
  "try",
  "check",
  "error",
  "issue",
  "task",
  "user",
  "team",
  "flow",
  "state",
  "status",
  "data",
  "value",
  "name",
  "type",
  "list",
  "page",
  "view",
  "main",
  "local",
  "remote",
  "public",
  "private",
  "default",
] as const;

const DOMAIN_WORDS = [
  "api",
  "app",
  "auth",
  "backend",
  "cache",
  "client",
  "cloud",
  "code",
  "config",
  "cookie",
  "cron",
  "css",
  "data",
  "database",
  "db",
  "debug",
  "deploy",
  "dev",
  "dns",
  "docker",
  "domain",
  "email",
  "endpoint",
  "event",
  "fetch",
  "frontend",
  "git",
  "github",
  "graphql",
  "grpc",
  "handler",
  "hook",
  "host",
  "html",
  "http",
  "https",
  "id",
  "index",
  "input",
  "ios",
  "json",
  "jwt",
  "key",
  "lambda",
  "layout",
  "linux",
  "local",
  "login",
  "logout",
  "macos",
  "message",
  "method",
  "metric",
  "model",
  "module",
  "node",
  "oauth",
  "object",
  "onnx",
  "page",
  "payload",
  "port",
  "post",
  "prod",
  "proxy",
  "query",
  "queue",
  "react",
  "redis",
  "redux",
  "repo",
  "request",
  "response",
  "rest",
  "route",
  "router",
  "schema",
  "sdk",
  "server",
  "service",
  "session",
  "socket",
  "sql",
  "ssh",
  "ssl",
  "state",
  "store",
  "stream",
  "sync",
  "tauri",
  "tcp",
  "test",
  "token",
  "ts",
  "type",
  "ui",
  "url",
  "uuid",
  "vite",
  "wasm",
  "web",
  "worker",
  "xcode",
  "xml",
  "yaml",
  "yarn",
  "zustand",
  "architecture",
  "adapter",
  "aggregate",
  "broker",
  "command",
  "component",
  "container",
  "controller",
  "gateway",
  "interface",
  "kubernetes",
  "middleware",
  "migration",
  "pipeline",
  "provider",
  "resolver",
  "resource",
  "scheduler",
  "singleton",
  "strategy",
  "terraform",
  "validator",
  "workflow",
] as const;

const BASE_BIGRAMS = [
  "hello world",
  "you are",
  "we are",
  "they are",
  "there are",
  "are you",
  "this is",
  "that is",
  "it is",
  "is the",
  "in the",
  "on the",
  "to the",
  "for the",
  "of the",
  "with the",
  "from the",
  "the quick",
  "quick note",
  "quick text",
  "good idea",
  "next step",
  "new note",
  "new idea",
  "save this",
  "copy this",
  "fix this",
  "need to",
  "we need",
  "should be",
  "must be",
] as const;

const DOMAIN_BIGRAMS = [
  "api request",
  "api response",
  "api server",
  "api client",
  "api endpoint",
  "auth token",
  "backend service",
  "cache key",
  "client request",
  "client server",
  "cloud function",
  "code review",
  "config file",
  "database query",
  "database schema",
  "docker container",
  "error state",
  "event handler",
  "fetch request",
  "frontend app",
  "graphql query",
  "http request",
  "http response",
  "https url",
  "json payload",
  "jwt token",
  "local dev",
  "login flow",
  "message queue",
  "node server",
  "oauth token",
  "post request",
  "proxy server",
  "react component",
  "redis cache",
  "request payload",
  "response body",
  "rest api",
  "route handler",
  "server client",
  "server request",
  "server response",
  "service worker",
  "state store",
  "web app",
  "web server",
  "worker thread",
  "system architecture",
  "api gateway",
  "event broker",
  "service mesh",
  "message broker",
  "data pipeline",
  "domain model",
  "resource controller",
  "kubernetes cluster",
  "terraform plan",
] as const;

const unique = (values: readonly string[]) => [...new Set(values)];

export const COMMON_WORDS = unique(BASE_COMMON_WORDS);
export const IT_DOMAIN_WORDS = unique([...DOMAIN_WORDS, ...DEVELOPER_WORDS]);
export const LANGUAGE_WORDS = unique([
  ...BASE_COMMON_WORDS,
  ...DOMAIN_WORDS,
  ...DEVELOPER_WORDS,
]);
export const LANGUAGE_BIGRAMS = unique([
  ...BASE_BIGRAMS,
  ...DOMAIN_BIGRAMS,
  ...DEVELOPER_BIGRAMS,
]);

export const LANGUAGE_WORD_RANK = new Map(
  LANGUAGE_WORDS.map((word, index) => [word, LANGUAGE_WORDS.length - index])
);
export const IT_DOMAIN_WORD_RANK = new Map(
  IT_DOMAIN_WORDS.map((word, index) => [word, IT_DOMAIN_WORDS.length - index])
);
export const LANGUAGE_BIGRAM_RANK = new Map(
  LANGUAGE_BIGRAMS.map((bigram, index) => [bigram, LANGUAGE_BIGRAMS.length - index])
);

const WORD_PREFIXES = new Set<string>();
LANGUAGE_WORDS.forEach((word) => {
  for (let length = 1; length <= word.length; length += 1) {
    WORD_PREFIXES.add(word.slice(0, length));
  }
});

const normalizeWord = (word: string) => word.toLowerCase();

export const isKnownLanguageWord = (word: string) =>
  LANGUAGE_WORD_RANK.has(normalizeWord(word));

export const isKnownDomainWord = (word: string) =>
  IT_DOMAIN_WORD_RANK.has(normalizeWord(word)) || isKnownDeveloperWord(word);

export const hasLanguageWordPrefix = (word: string) =>
  WORD_PREFIXES.has(normalizeWord(word));

export const getKnownWordRank = (word: string) =>
  LANGUAGE_WORD_RANK.get(normalizeWord(word)) ?? 0;

const getWords = (text: string) =>
  [...text.matchAll(/[A-Za-z]+/g)].map((match) => match[0].toLowerCase());

const getCompletedWords = (text: string, prefixMode: boolean) => {
  const words = getWords(text);
  if (!prefixMode || /\s$/.test(text) || words.length === 0) return words;
  return words.slice(0, -1);
};

const getLastWord = (text: string) => {
  const match = text.match(/[A-Za-z]+$/);
  return match ? match[0].toLowerCase() : "";
};

const getWordScore = (word: string) => {
  const rank = LANGUAGE_WORD_RANK.get(word) ?? 0;
  if (rank === 0) return isKnownDeveloperWord(word) ? getDeveloperWordScore(word) : -0.18;

  const commonBonus = Math.min(0.9, rank / 150);
  const domainBonus = IT_DOMAIN_WORD_RANK.has(word) ? 0.65 : 0;
  return commonBonus + domainBonus;
};

const getPhrasePatternScore = (text: string) => {
  const normalized = text.toLowerCase();
  let score = 0;

  if (/\bhttps?:\/\//.test(normalized)) score += 1.8;
  if (/\bapi[./: ]/.test(normalized)) score += 0.45;
  if (/\b(get|post|put|patch|delete)\s+(request|response|api|url|endpoint)\b/.test(normalized)) {
    score += 0.7;
  }
  if (/\b(request|response)\s+(body|payload|data|json)\b/.test(normalized)) {
    score += 0.55;
  }
  if (/\b(server|client|cache|queue|database|endpoint|token)\b/.test(normalized)) {
    score += 0.3;
  }
  score += getDeveloperPhraseScore(text) * 0.55;

  return score;
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

  if (/ {2,}/.test(text)) score -= 0.7;
  if (/^[!'",.;:?]/.test(text)) score -= 0.35;
  if (/[A-Za-z]{18,}/.test(text)) score -= 0.55;

  return score;
};

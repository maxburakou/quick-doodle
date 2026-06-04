import { PROJECT_DEVELOPER_WORDS } from "./projectLexicon";

const BASE_DEVELOPER_TERMS = [
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
] as const;

const EXTENDED_DEVELOPER_TERMS = [
  "accessor",
  "adapter",
  "aggregate",
  "algorithm",
  "async",
  "await",
  "batch",
  "boolean",
  "branch",
  "broker",
  "browser",
  "build",
  "bundle",
  "callback",
  "camelcase",
  "checksum",
  "cli",
  "clipboard",
  "clone",
  "command",
  "commit",
  "component",
  "container",
  "context",
  "controller",
  "cors",
  "crud",
  "daemon",
  "dataset",
  "debounce",
  "dependency",
  "deploy",
  "diff",
  "dto",
  "enum",
  "eslint",
  "exception",
  "fallback",
  "firewall",
  "framework",
  "gateway",
  "generic",
  "hydrate",
  "immutable",
  "import",
  "interface",
  "iterator",
  "kebabcase",
  "kubernetes",
  "linter",
  "middleware",
  "migration",
  "mock",
  "monorepo",
  "namespace",
  "nullable",
  "nullish",
  "package",
  "parser",
  "pipeline",
  "plugin",
  "polling",
  "prettier",
  "provider",
  "readonly",
  "rebase",
  "refactor",
  "registry",
  "resolver",
  "resource",
  "rollback",
  "runtime",
  "scheduler",
  "singleton",
  "snakecase",
  "snippet",
  "storybook",
  "strategy",
  "terraform",
  "timeout",
  "transaction",
  "typescript",
  "validator",
  "viewport",
  "workflow",
  "workspace",
  "webhook",
] as const;

const CODE_SURFACE_TERMS = [
  ".env",
  "dockerfile",
  "github",
  "gitignore",
  "lockfile",
  "nextjs",
  "node_modules",
  "package.json",
  "pnpm",
  "postgres",
  "readme",
  "tailwind",
  "tsconfig",
  "tsx",
  "usecallback",
  "useeffect",
  "usestate",
  "viteconfig",
] as const;

export const DEVELOPER_WORDS = [
  ...new Set([
    ...BASE_DEVELOPER_TERMS,
    ...EXTENDED_DEVELOPER_TERMS,
    ...CODE_SURFACE_TERMS,
    ...PROJECT_DEVELOPER_WORDS,
  ]),
];

export const DEVELOPER_BIGRAMS = [
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
  "docker compose",
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
  "package json",
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
  "tauri app",
  "typescript type",
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

const DEVELOPER_WORD_RANK = new Map<string, number>(
  DEVELOPER_WORDS.map((word, index) => [word, DEVELOPER_WORDS.length - index])
);

const DEVELOPER_WORD_PREFIXES = new Set<string>();
DEVELOPER_WORDS.forEach((word) => {
  const normalized = word.replace(/[^a-z0-9]/g, "");
  for (let length = 1; length <= normalized.length; length += 1) {
    DEVELOPER_WORD_PREFIXES.add(normalized.slice(0, length));
  }
});

const normalizeDeveloperToken = (token: string) =>
  token.toLowerCase().replace(/[^a-z0-9]/g, "");

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

export const isKnownDeveloperWord = (word: string) =>
  DEVELOPER_WORD_RANK.has(word.toLowerCase()) ||
  DEVELOPER_WORD_RANK.has(normalizeDeveloperToken(word));

export const hasDeveloperWordPrefix = (word: string) =>
  DEVELOPER_WORD_PREFIXES.has(normalizeDeveloperToken(word));

export const getDeveloperWordRank = (word: string) =>
  DEVELOPER_WORD_RANK.get(word.toLowerCase()) ??
  DEVELOPER_WORD_RANK.get(normalizeDeveloperToken(word)) ??
  0;

export const getDeveloperWordScore = (word: string) => {
  const rank = getDeveloperWordRank(word);
  if (rank === 0) return 0;
  return 0.65 + Math.min(0.85, rank / 170);
};

export const getDeveloperTokenCandidates = (token: string) => {
  const normalized = normalizeDeveloperToken(token);
  if (normalized.length < 2) return [];

  const maxDistance = normalized.length <= 3
    ? 1
    : Math.max(1, Math.ceil(normalized.length * 0.32));

  return DEVELOPER_WORDS
    .map((word) => ({
      word,
      normalizedWord: normalizeDeveloperToken(word),
    }))
    .filter(({ normalizedWord }) => {
      if (Math.abs(normalizedWord.length - normalized.length) > maxDistance) {
        return false;
      }
      return levenshtein(normalized, normalizedWord) <= maxDistance;
    })
    .sort((left, right) => {
      const leftDistance = levenshtein(normalized, left.normalizedWord);
      const rightDistance = levenshtein(normalized, right.normalizedWord);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return getDeveloperWordRank(right.word) - getDeveloperWordRank(left.word);
    })
    .map(({ word }) => word)
    .slice(0, 8);
};

export const getDeveloperPhraseScore = (text: string) => {
  const normalized = text.toLowerCase().replace(/[._/-]+/g, " ");
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  let score = words.reduce((sum, word) => sum + getDeveloperWordScore(word), 0);

  for (let index = 1; index < words.length; index += 1) {
    const bigram = `${words[index - 1]} ${words[index]}`;
    if (DEVELOPER_BIGRAMS.includes(bigram as (typeof DEVELOPER_BIGRAMS)[number])) {
      score += 1.1;
    }
  }

  if (/[A-Za-z]+[A-Z][A-Za-z]*/.test(text)) score += 0.45;
  if (/[a-z]+_[a-z0-9_]+/.test(text)) score += 0.4;
  if (/[a-z]+-[a-z0-9-]+/.test(text)) score += 0.32;
  if (/\b[a-z]+\.json\b/i.test(text)) score += 0.85;
  if (/\b[A-Z]{2,}\b/.test(text)) score += 0.25;

  return score;
};

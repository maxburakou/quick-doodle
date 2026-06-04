const splitWords = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

const splitPhrases = (value: string) =>
  value
    .trim()
    .split("\n")
    .map((phrase) => phrase.trim().toLowerCase())
    .filter(Boolean);

const unique = (values: string[]) => [...new Set(values)];

const COMMON_WORD_GROUPS = {
  general: splitWords(`
    the and you that was for are with his they this have from one had word but
    not what all were when your can said there use each which she how their will
    other about out many then them these some her would make like him into time
    has look two more write see number way could people than first water been
    call who oil now find long down day did get come made may part
  `),
  drawing: splitWords(`
    hello hi hey world test text quick note todo draw line shape thing right left
    good bad yes please thanks work home app code fix done start stop open close save
    copy move idea plan next back new old big small same real true false why
    where need needs should must create update delete read write load send
    receive build run try check error issue task user team flow state status
    data value name type list page view main local remote public private default
  `),
} as const;

const COMMON_PHRASE_GROUPS = {
  general: splitPhrases(`
    hello world
    you are
    we are
    they are
    there are
    are you
    this is
    that is
    it is
    is the
    in the
    on the
    to the
    for the
    of the
    with the
    from the
    the quick
    quick note
    quick text
    good idea
    next step
    new note
    new idea
    save this
    copy this
    fix this
    need to
    we need
    should be
    must be
  `),
} as const;

const DEVELOPER_WORD_GROUPS = {
  core: splitWords(`
    api app auth backend cache client cloud code config cookie cron css data
    database db debug deploy dev dns docker domain email endpoint event fetch
    frontend git github graphql grpc handler hook host html http https id index
    input ios json jwt key lambda layout linux local login logout macos message
    method metric model module node oauth object onnx page payload port post prod
    proxy query queue react redis redux repo request response rest route router
    schema sdk server service session socket sql ssh ssl state store stream sync
    tauri tcp test token ts type ui url uuid vite wasm web worker xcode xml yaml
    yarn zustand
  `),
  architecture: splitWords(`
    architecture availability balancer boundary broker bus cap cdc consistency
    consumer cqrs ddd dependency discovery distributed domain driven eventual
    failover gateway hexagonal load mesh microservice microservices monolith
    orchestration orchestrator producer pubsub publisher queue region replica
    replication saga shard sharding stream subscriber topology transaction
    workflow zone
  `),
  designPatterns: splitWords(`
    abstract adapter aggregate bridge builder command composite decorator factory
    facade flyweight mediator memento observer prototype repository singleton
    specification state strategy template visitor mvc mvp mvvm clean layered
    onion ports presenter interactor usecase usecases viewmodel
  `),
  engineering: splitWords(`
    abstraction accessor admin agile algorithm alias allocate analytics annotation
    arg argument array assertion asset async audit authn authz autoscale
    autoscaling await backup bash batch binary bind binding bit boolean
    bottleneck branch buffer build bundle callback camelcase canary cd cdn
    checksum ci cicd class cli clone closure cluster codemod compiler component
    compose compression concurrency conditional connection constant constructor
    container context controller cors cpu crash credential crud crypto dashboard
    dataflow dataset deadlock debounce decrypt default dependency deserialize
    diff digest dto dump encrypt enum environment error eslint exception export
    fallback feature field fixture flag flaky flow framework function generic
    hash header hydrate immutable import implementation incident indexer infra
    infrastructure ingress integration interface invariant iterator job
    kebabcase latency linter lockfile log logger middleware migration mock
    monorepo mutable namespace nullable nullish observability oncall operator
    overload package pagination parser partition patch pipeline plugin polling
    polyfill predicate preview primitive priority profiler provider readonly
    rebase recursion refactor registry release renderer resolver resource retry
    rollback runtime scalar scheduler secret selector semaphore serialization
    serializer shim snakecase snapshot source span spec spike sprint staging
    subscription telemetry terraform throttle timeout trace tuple validation
    validator viewport workspace webhook
  `),
  backendData: splitWords(`
    acid activerecord cassandra clickhouse crud database dataloader dynamodb
    elastic elasticsearch etl index indexer join knex materialized mongodb mysql
    nosql orm postgres postgresql primary prisma query readonly readmodel redis
    relation replica search secondary snowflake sqlite stored procedure sql
    timeseries trigger warehouse writeback
  `),
  cloudDevops: splitWords(`
    admission affinity ansible argocd aws azure configmap daemon daemonset
    deployment devops docker dockerfile egress eks etcd gcp gitops grafana helm
    hpa iac image istio k8s kubectl kubelet kubernetes loki manifest minikube
    namespace nodeport ops pod probe prometheus pulumi replicaset scaling
    serviceaccount sidecar sre terraform volume workload
  `),
  frontendDesign: splitWords(`
    accessibility animation aria atomic breakpoint canvas card carousel component
    constraint css design figma flexbox grid icon interaction layout mockup modal
    motion palette popover prototype responsive screen spacing storybook style
    stylesheet tailwind theme token typography ux variant viewport wireframe
  `),
  mobileDesktop: splitWords(`
    android appkit catalyst cocoa desktop electron flutter ios jetpack kotlin
    macos mobile native objectivec qt reactnative shell swift swiftui tauri uikit
    winui xaml xcode
  `),
  platformAi: splitWords(`
    ai agent ajax alpine angular apollo astro babel bun cargo celery centos
    chatgpt clojure clion cloudflare cmake codegen confluence copilot cpp
    csharp cuda cursor cypress datadog deno django edge electron elixir
    embedding embeddings express fastapi firebase flask gemini gitea gitlab go
    gradle gpu heroku htmx inference java javascript jest jira kafka kotlin ksql
    kusto language laravel llm markdown nextjs nginx nix npm nuxt objectivec
    ollama openai opensearch openapi opentelemetry openssl playwright pnpm
    prompt protobuf python pytorch rag rails rust scala sentry solid spring
    svelte threejs tokenizer transformer tokio tomcat turborepo typescript
    ubuntu unix vector vitepress vitest vscode vue webpack zig
  `),
  security: splitWords(`
    acl aes authentication authorization bcrypt cipher csrf csp ddos decrypt dos
    encrypt encryption hmac hsts mfa nonce oidc otp owasp passkey permission
    policy privacy rbac refresh salt samesite saml sanitizer signature sso tls
    vulnerability xss
  `),
  localApp: splitWords(`
    activation assist canvas doodle highlighter marquee popover rough shortcut
    smart snap stroke toolbar
  `),
  slang: splitWords(`
    backlog bikeshed blocked breakage broken bug bust cacheable chmod cleanup
    debugged dedupe docs downtime duplicate greenfield hotfix lgtm lint linting
    merge nits outage pager postmortem prodish repro rfc ship shipped shipit
    smoke stale task triage unblock wip workaround
  `),
} as const;

const DEVELOPER_PHRASE_GROUPS = {
  core: splitPhrases(`
    access token
    api client
    api endpoint
    api gateway
    api request
    api response
    api route
    api server
    auth flow
    auth token
    backend service
    build artifact
    build pipeline
    cache hit
    cache key
    cache miss
    ci pipeline
    client request
    client server
    cloud function
    code review
    config file
    data pipeline
    database migration
    database query
    database schema
    dev server
    docker compose
    docker container
    docker image
    event handler
    feature flag
    fetch request
    frontend app
    graphql query
    http header
    http request
    http response
    integration test
    json payload
    jwt token
    local dev
    log message
    login flow
    message queue
    node server
    oauth token
    oidc provider
    package manager
    pull request
    query param
    rate limit
    react component
    redis cache
    refresh token
    request body
    request payload
    response body
    rest api
    route handler
    server request
    server response
    service worker
    smoke test
    stack trace
    state store
    test suite
    trace id
    typescript type
    unit test
    web app
    web server
    web socket
    worker thread
  `),
  architecture: splitPhrases(`
    api gateway
    availability zone
    bounded context
    circuit breaker
    clean architecture
    command handler
    command query
    database replica
    dead letter
    domain event
    domain model
    event broker
    event bus
    event sourcing
    event stream
    eventual consistency
    hexagonal architecture
    load balancer
    message broker
    message bus
    microservice architecture
    orchestration layer
    read model
    reverse proxy
    saga pattern
    service discovery
    service mesh
    system architecture
    tech debt
  `),
  designPatterns: splitPhrases(`
    abstract factory
    adapter pattern
    builder pattern
    decorator pattern
    facade pattern
    factory method
    observer pattern
    repository pattern
    singleton pattern
    strategy pattern
    template method
    use case
    view model
  `),
  cloudDevops: splitPhrases(`
    container orchestration
    docker image
    horizontal scaling
    kubernetes cluster
    kubernetes ingress
    load balancer
    oncall rotation
    prometheus metrics
    terraform plan
  `),
  frontendDesign: splitPhrases(`
    design system
    design token
    error boundary
    loading state
    mobile layout
    responsive layout
    ui component
    user flow
    visual hierarchy
  `),
  ai: splitPhrases(`
    language model
    large language
    llm app
    prompt engineering
    vector database
  `),
} as const;

const WEIGHTED_PHRASES = [
  ...DEVELOPER_PHRASE_GROUPS.architecture.map((phrase) => [phrase, 1.35] as const),
  ...DEVELOPER_PHRASE_GROUPS.designPatterns.map((phrase) => [phrase, 1.25] as const),
  ...DEVELOPER_PHRASE_GROUPS.frontendDesign.map((phrase) => [phrase, 1.15] as const),
  ...DEVELOPER_PHRASE_GROUPS.cloudDevops.map((phrase) => [phrase, 1.2] as const),
  ...DEVELOPER_PHRASE_GROUPS.ai.map((phrase) => [phrase, 1.15] as const),
  ...DEVELOPER_PHRASE_GROUPS.core.map((phrase) => [phrase, 1.1] as const),
];

export const COMMON_WORDS = unique(Object.values(COMMON_WORD_GROUPS).flat());

export const DEVELOPER_WORDS = unique(Object.values(DEVELOPER_WORD_GROUPS).flat());

export const IT_DOMAIN_WORDS = DEVELOPER_WORDS;

export const LANGUAGE_WORDS = COMMON_WORDS;

export const DEVELOPER_BIGRAMS = unique(
  Object.values(DEVELOPER_PHRASE_GROUPS).flat()
).filter((phrase) => phrase.split(/\s+/).length === 2);

export const LANGUAGE_BIGRAMS = unique([
  ...Object.values(COMMON_PHRASE_GROUPS).flat(),
  ...DEVELOPER_BIGRAMS,
]);

const DEVELOPER_PHRASE_SCORE = new Map<string, number>(WEIGHTED_PHRASES);

export const LANGUAGE_WORD_RANK = new Map(
  LANGUAGE_WORDS.map((word, index) => [word, LANGUAGE_WORDS.length - index])
);

export const IT_DOMAIN_WORD_RANK = new Map(
  IT_DOMAIN_WORDS.map((word, index) => [word, IT_DOMAIN_WORDS.length - index])
);

export const LANGUAGE_BIGRAM_RANK = new Map(
  LANGUAGE_BIGRAMS.map((bigram, index) => [
    bigram,
    LANGUAGE_BIGRAMS.length - index,
  ])
);

const DEVELOPER_WORD_RANK = new Map<string, number>(
  DEVELOPER_WORDS.map((word, index) => [word, DEVELOPER_WORDS.length - index])
);

export const LANGUAGE_WORD_PREFIXES = new Set<string>();
LANGUAGE_WORDS.forEach((word) => {
  for (let length = 1; length <= word.length; length += 1) {
    LANGUAGE_WORD_PREFIXES.add(word.slice(0, length));
  }
});

const DEVELOPER_WORD_PREFIXES = new Set<string>();
DEVELOPER_WORDS.forEach((word) => {
  const normalized = word.replace(/[^a-z0-9]/g, "");
  for (let length = 1; length <= normalized.length; length += 1) {
    DEVELOPER_WORD_PREFIXES.add(normalized.slice(0, length));
  }
});

const TOKEN_STYLE_HINTS = [
  { pattern: /[A-Za-z]+[A-Z][A-Za-z]*/, score: 0.45 },
  { pattern: /[a-z]+_[a-z0-9_]+/, score: 0.4 },
  { pattern: /[a-z]+-[a-z0-9-]+/, score: 0.32 },
  { pattern: /\b[a-z]+\.json\b/i, score: 0.65 },
  { pattern: /\b[A-Z]{2,}\b/, score: 0.25 },
] as const;

const normalizeDeveloperToken = (token: string) =>
  token.toLowerCase().replace(/[^a-z0-9]/g, "");

const DEVELOPER_TOKEN_CANDIDATES = DEVELOPER_WORDS.map((word) => ({
  word,
  normalizedWord: normalizeDeveloperToken(word),
}));

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

export const isKnownLanguageWord = (word: string) =>
  LANGUAGE_WORD_RANK.has(word.toLowerCase());

export const isKnownDomainWord = (word: string) =>
  IT_DOMAIN_WORD_RANK.has(word.toLowerCase()) || isKnownDeveloperWord(word);

export const hasLanguageWordPrefix = (word: string) =>
  LANGUAGE_WORD_PREFIXES.has(word.toLowerCase());

export const getKnownWordRank = (word: string) =>
  LANGUAGE_WORD_RANK.get(word.toLowerCase()) ?? 0;

export const getDeveloperWordScore = (word: string) => {
  const rank = getDeveloperWordRank(word);
  if (rank === 0) return 0;
  return 0.65 + Math.min(0.85, rank / 170);
};

export const getDeveloperTokenCandidates = (token: string) => {
  const normalized = normalizeDeveloperToken(token);
  if (normalized.length < 2) return [];

  const maxDistance =
    normalized.length <= 3
      ? 1
      : Math.max(1, Math.ceil(normalized.length * 0.32));

  return DEVELOPER_TOKEN_CANDIDATES
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

const getPhraseWindowScores = (words: string[]) => {
  let score = 0;

  for (let start = 0; start < words.length; start += 1) {
    for (let length = 2; length <= 3; length += 1) {
      const phrase = words.slice(start, start + length).join(" ");
      score += DEVELOPER_PHRASE_SCORE.get(phrase) ?? 0;
    }
  }

  return score;
};

export const getDeveloperPhraseScore = (text: string) => {
  const normalized = text.toLowerCase().replace(/[._/-]+/g, " ");
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  const wordScore = words.reduce(
    (sum, word) => sum + getDeveloperWordScore(word),
    0
  );
  const phraseScore = getPhraseWindowScores(words);
  const styleScore = TOKEN_STYLE_HINTS.reduce(
    (sum, hint) => sum + (hint.pattern.test(text) ? hint.score : 0),
    0
  );

  return wordScore + phraseScore + styleScore;
};

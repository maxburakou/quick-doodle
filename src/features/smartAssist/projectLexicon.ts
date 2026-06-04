import packageJsonRaw from "../../../package.json?raw";

const LOCAL_APP_WORDS = [
  "activation",
  "assist",
  "canvas",
  "doodle",
  "highlighter",
  "marquee",
  "popover",
  "rough",
  "shortcut",
  "smart",
  "snap",
  "stroke",
  "toolbar",
] as const;

const splitIdentifier = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2);

const getPackageWords = () => {
  try {
    const parsed = JSON.parse(packageJsonRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      name?: string;
    };
    const names = [
      parsed.name ?? "",
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ];

    return names.flatMap((name) => splitIdentifier(name.replace(/^@/, "")));
  } catch {
    return [];
  }
};

export const PROJECT_DEVELOPER_WORDS = [
  ...new Set([...getPackageWords(), ...LOCAL_APP_WORDS]),
];

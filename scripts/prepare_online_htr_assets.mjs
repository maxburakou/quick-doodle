#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceAssetsDir = path.join(repoRoot, ".disk", "models", "online-htr");
const publicAssetsDir = path.join(repoRoot, "public", "models", "online-htr");
const sourceModelPath = path.join(sourceAssetsDir, "model.onnx");
const sourceAlphabetPath = path.join(sourceAssetsDir, "alphabet.json");
const publicModelPath = path.join(publicAssetsDir, "model.onnx");
const publicAlphabetPath = path.join(publicAssetsDir, "alphabet.json");

const hasSourceAssets = () => existsSync(sourceModelPath) && existsSync(sourceAlphabetPath);
const hasPublicAssets = () => existsSync(publicModelPath) && existsSync(publicAlphabetPath);
const copySourceToPublic = () => {
  mkdirSync(publicAssetsDir, { recursive: true });
  copyFileSync(sourceModelPath, publicModelPath);
  copyFileSync(sourceAlphabetPath, publicAlphabetPath);
};

if (hasSourceAssets()) {
  if (!hasPublicAssets()) {
    copySourceToPublic();
  }
  process.exit(0);
}

const onlineHtrRepo = process.env.QUICK_DOODLE_ONLINE_HTR_REPO;
const modelDir = process.env.QUICK_DOODLE_ONLINE_HTR_MODEL_DIR;

if (!onlineHtrRepo) {
  console.error(`
Online HTR assets are missing.

Expected:
  ${path.relative(repoRoot, sourceModelPath)}
  ${path.relative(repoRoot, sourceAlphabetPath)}

For product builds these files must be committed or produced by CI before
packaging. End users should never generate them.

For local development, set:
  export QUICK_DOODLE_ONLINE_HTR_REPO=/path/to/OnlineHTR
  export QUICK_DOODLE_ONLINE_HTR_MODEL_DIR=/path/to/OnlineHTR/models/dataIAMOnDB_featuresLinInterpol20DxDyDtN_decoderGreedy

Then rerun the command. The assets will be exported automatically.
`);
  process.exit(1);
}

const python = process.env.PYTHON ?? process.env.PYTHON3 ?? "python3";
const args = [
  path.join(repoRoot, "scripts", "export_online_htr_onnx.py"),
  "--online-htr-repo",
  onlineHtrRepo,
];

if (modelDir) {
  args.push("--model-dir", modelDir);
}

const result = spawnSync(python, args, {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!hasSourceAssets()) {
  console.error("Online HTR export finished, but model.onnx/alphabet.json are still missing.");
  process.exit(1);
}

copySourceToPublic();

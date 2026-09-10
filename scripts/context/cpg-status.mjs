import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  fingerprintFile,
  fingerprintJsonFile,
  getCpgGeneratorState,
  getCpgSourceState
} from "./cpg-source.mjs";

const args = process.argv.slice(2);
const repoArg = args[0] && !args[0].startsWith("--") ? args.shift() : ".";
const repoRoot = path.resolve(repoArg);
const flags = new Set(args);
const jsonOutput = flags.has("--json");
const checkMode = flags.has("--check");

const source = await getCpgSourceState(repoRoot);
const generator = await getCpgGeneratorState(repoRoot, source.config);
const outputDir = path.join(repoRoot, source.config.generated?.cpgDirectory ?? ".context/cpg");
const cpgPath = path.join(outputDir, "cpg.bin");
const buildPath = path.join(outputDir, "build.json");
const lockPath = path.join(repoRoot, ".context/joern.lock.json");
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const joernLockFingerprint = await fingerprintJsonFile(lockPath);

async function isNonEmptyFile(filePath) {
  const fileStat = await stat(filePath).catch(() => null);
  return Boolean(fileStat?.isFile() && fileStat.size > 0);
}

function currentCommit() {
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function diffFileHashes(built = {}, current = {}) {
  const added = [];
  const modified = [];
  const removed = [];
  const paths = new Set([...Object.keys(built), ...Object.keys(current)]);

  for (const filePath of [...paths].sort()) {
    if (!(filePath in built)) added.push(filePath);
    else if (!(filePath in current)) removed.push(filePath);
    else if (built[filePath] !== current[filePath]) modified.push(filePath);
  }

  return { added, modified, removed };
}

const reasons = [];
let status = "CURRENT";
let build = null;
let currentCpgSha256 = null;

if (!(await isNonEmptyFile(cpgPath))) {
  status = "MISSING";
  reasons.push("cpg_missing");
} else {
  currentCpgSha256 = await fingerprintFile(cpgPath);
}

try {
  build = JSON.parse(await readFile(buildPath, "utf8"));
} catch {
  status = "MISSING";
  reasons.push("build_metadata_missing");
}

let changedFiles = { added: [], modified: [], removed: [] };
let changedGeneratorFiles = { added: [], modified: [], removed: [] };

if (build && status !== "MISSING") {
  if (build.schemaVersion !== 3) reasons.push("metadata_schema_changed");
  if (build.generator !== "joern") reasons.push("generator_changed");
  if (build.version !== lock.version) reasons.push("joern_version_changed");
  if (build.joernLockFingerprint !== joernLockFingerprint) reasons.push("joern_lock_changed");
  if (build.configFingerprint !== source.configFingerprint) reasons.push("config_changed");

  if (build.generatorFingerprint !== generator.generatorFingerprint) {
    reasons.push("generator_implementation_changed");
    changedGeneratorFiles = diffFileHashes(
      build.generatorFileHashes,
      generator.generatorFileHashes
    );
  }

  if (!build.cpgSha256 || build.cpgSha256 !== currentCpgSha256) {
    reasons.push("cpg_checksum_changed");
  }

  if (build.sourceFingerprint !== source.sourceFingerprint) {
    reasons.push("source_changed");
    changedFiles = diffFileHashes(build.fileHashes, source.fileHashes);
  }

  if (reasons.length > 0) status = "STALE";
}

const result = {
  status,
  reasons,
  currentCommit: currentCommit(),
  builtFromCommit: build?.commit ?? null,
  currentSourceFingerprint: source.sourceFingerprint,
  builtSourceFingerprint: build?.sourceFingerprint ?? null,
  currentConfigFingerprint: source.configFingerprint,
  builtConfigFingerprint: build?.configFingerprint ?? null,
  currentGeneratorFingerprint: generator.generatorFingerprint,
  builtGeneratorFingerprint: build?.generatorFingerprint ?? null,
  currentJoernVersion: lock.version ?? null,
  builtJoernVersion: build?.version ?? null,
  currentCpgSha256,
  builtCpgSha256: build?.cpgSha256 ?? null,
  fileCount: source.fileCount,
  changedFiles,
  changedGeneratorFiles
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(`CPG STATUS: ${status}`);
  if (reasons.length > 0) console.log(`Reasons: ${reasons.join(", ")}`);

  const changedCount = changedFiles.added.length + changedFiles.modified.length + changedFiles.removed.length;
  if (changedCount > 0) {
    console.log(`Changed source files: ${changedCount}`);
    for (const filePath of [...changedFiles.added, ...changedFiles.modified, ...changedFiles.removed].slice(0, 10)) {
      console.log(`- ${filePath}`);
    }
    if (changedCount > 10) console.log(`- ... and ${changedCount - 10} more`);
  }

  const changedGeneratorCount =
    changedGeneratorFiles.added.length +
    changedGeneratorFiles.modified.length +
    changedGeneratorFiles.removed.length;
  if (changedGeneratorCount > 0) {
    console.log(`Changed generator files: ${changedGeneratorCount}`);
    for (const filePath of [
      ...changedGeneratorFiles.added,
      ...changedGeneratorFiles.modified,
      ...changedGeneratorFiles.removed
    ].slice(0, 10)) {
      console.log(`- ${filePath}`);
    }
    if (changedGeneratorCount > 10) {
      console.log(`- ... and ${changedGeneratorCount - 10} more`);
    }
  }
}

if (checkMode && status !== "CURRENT") process.exitCode = 1;

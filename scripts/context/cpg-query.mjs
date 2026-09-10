import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveJoernTool } from "./joern-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const supportedModes = new Set(["symbol", "callers", "callees", "impact", "path"]);

function fail(message) {
  console.error(`CPG query error: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  npm run context:cpg:symbol -- <symbol>
  npm run context:cpg:callers -- <symbol>
  npm run context:cpg:callees -- <symbol>
  npm run context:cpg:impact -- <symbol> [--depth N]
  npm run context:cpg:path -- <from> <to> [--depth N]

The CPG must be CURRENT before a query is executed.`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const mode = args.shift();
if (!supportedModes.has(mode)) fail(`Unsupported query mode: ${mode}`);

let depth = mode === "path" ? 8 : mode === "impact" ? 2 : 1;
const depthIndex = args.indexOf("--depth");
if (depthIndex >= 0) {
  const value = Number.parseInt(args[depthIndex + 1] ?? "", 10);
  if (!Number.isInteger(value) || value < 1 || value > 20) fail("--depth must be an integer between 1 and 20");
  depth = value;
  args.splice(depthIndex, 2);
}

const symbol = args.shift();
if (!symbol) fail(`${mode} requires a symbol`);
const target = mode === "path" ? args.shift() : "";
if (mode === "path" && !target) fail("path requires both <from> and <to> symbols");
if (args.length > 0) fail(`Unexpected arguments: ${args.join(" ")}`);

const statusScript = path.join(repoRoot, "scripts/context/cpg-status.mjs");
const statusRun = spawnSync(process.execPath, [statusScript, "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024
});
if (statusRun.status !== 0 && !statusRun.stdout) {
  fail(statusRun.stderr.trim() || "Unable to determine CPG status");
}

let status;
try {
  status = JSON.parse(statusRun.stdout);
} catch {
  fail(`Unable to parse CPG status: ${statusRun.stdout || statusRun.stderr}`);
}

if (status.status !== "CURRENT") {
  const reasons = status.reasons?.length ? ` (${status.reasons.join(", ")})` : "";
  fail(`CPG is ${status.status}${reasons}. Run npm run context:cpg:build before querying it.`);
}

let joern;
try {
  joern = await resolveJoernTool(repoRoot, "joern", "JOERN_BIN");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const queryScript = path.join(repoRoot, "scripts/context/joern/query.sc");
const cpgFile = path.join(repoRoot, ".context/cpg/cpg.bin");
const cacheRoot = path.join(repoRoot, ".context/cache");
await mkdir(path.join(cacheRoot, "queries"), { recursive: true });
const tempDir = await mkdtemp(path.join(cacheRoot, "queries", `${mode}-`));
const outputFile = path.join(tempDir, "result.json");

try {
  const queryRun = spawnSync(joern, [
    "--script", queryScript,
    "--param", `cpgFile=${cpgFile}`,
    "--param", `mode=${mode}`,
    "--param", `symbol=${symbol}`,
    "--param", `target=${target ?? ""}`,
    "--param", `depth=${depth}`,
    "--param", `outFile=${outputFile}`
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  if (queryRun.status !== 0) {
    fail(queryRun.stderr.trim() || queryRun.stdout.trim() || `Joern exited with code ${queryRun.status}`);
  }

  const raw = await readFile(outputFile, "utf8").catch(() => null);
  if (!raw) fail("Joern completed without producing query output");

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    fail(`Joern produced invalid JSON: ${raw.slice(0, 500)}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

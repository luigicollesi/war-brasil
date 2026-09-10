import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveJoernTool } from "./joern-runtime.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptFile), "../..");
const supportedModes = new Set(["usages", "dataflow"]);
const emptySliceMarker = "Empty slice, no file generated.";

function fail(message) {
  console.error(`CPG slice error: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  npm run context:cpg:usages -- <variable> [--method NAME] [--file PATH] [--include-source] [--exclude-operators]
  npm run context:cpg:dataflow -- <sink> [--depth N] [--method NAME] [--file PATH] [--regex] [--end-at-external-method]

The CPG must be CURRENT before slicing. Data-flow depth defaults to 8 and accepts 1-20.`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function optionValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  return value;
}

function compactProcessOutput(value) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "<empty>";
  return normalized.length <= 800 ? normalized : `${normalized.slice(0, 800)}…`;
}

export function emptySliceForMode(mode) {
  if (mode === "usages") return { objectSlices: [], userDefinedTypes: [] };
  if (mode === "dataflow") return { nodes: [], edges: [] };
  throw new Error(`Unsupported slice mode: ${mode}`);
}

export function interpretMissingSliceOutput(mode, stdout = "", stderr = "") {
  const combined = `${stdout}\n${stderr}`;
  return combined.includes(emptySliceMarker) ? emptySliceForMode(mode) : null;
}

export function formatMissingSliceDiagnostic({ mode, query, method, file, stdout, stderr }) {
  return [
    "joern-slice completed without producing JSON and did not report an empty slice.",
    `mode=${mode}`,
    `query=${query}`,
    `method=${method ?? "<none>"}`,
    `file=${file ?? "<none>"}`,
    `stdout=${compactProcessOutput(stdout)}`,
    `stderr=${compactProcessOutput(stderr)}`
  ].join(" ");
}

export function matchesMethodScope(fullName, requestedMethod) {
  if (!requestedMethod) return true;
  const full = String(fullName ?? "");
  if (full === requestedMethod) return true;
  const escaped = escapeRegex(requestedMethod);
  return new RegExp(`(?:^|[.:/$])${escaped}(?:$|[:(<])`).test(full);
}

export function matchesFileScope(fileName, requestedFile) {
  if (!requestedFile) return true;
  const candidate = normalizePath(fileName);
  const requested = normalizePath(requestedFile);
  return candidate === requested || candidate.endsWith(`/${requested}`);
}

export function filterUsageResult(raw, query, includeSource = false, scope = {}) {
  const methods = Array.isArray(raw?.objectSlices) ? raw.objectSlices : [];
  const resultMethods = [];
  let matchCount = 0;

  for (const method of methods) {
    if (!matchesMethodScope(method?.fullName, scope.method)) continue;
    if (!matchesFileScope(method?.fileName, scope.file)) continue;

    const slices = Array.isArray(method?.slices) ? method.slices : [];
    const matches = slices.filter((slice) => {
      const targetName = slice?.targetObj?.name;
      const definedByName = slice?.definedBy?.name;
      return targetName === query || definedByName === query;
    });

    if (matches.length === 0) continue;
    matchCount += matches.length;

    const compact = {
      fullName: method.fullName ?? "",
      fileName: method.fileName ?? "",
      lineNumber: method.lineNumber ?? null,
      columnNumber: method.columnNumber ?? null,
      slices: matches
    };
    if (includeSource && typeof method.code === "string") compact.code = method.code;
    resultMethods.push(compact);
  }

  return {
    command: "usages",
    query,
    matchCount,
    methods: resultMethods
  };
}

export function filterDataflowScope(raw, scope = {}) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw?.edges) ? raw.edges : [];
  if (!scope.method && !scope.file) return { ...raw, nodes, edges };

  const anchorIds = new Set(
    nodes
      .filter((node) =>
        matchesMethodScope(node?.parentMethod, scope.method) &&
        matchesFileScope(node?.parentFile, scope.file)
      )
      .map((node) => node.id)
  );

  if (anchorIds.size === 0) return { ...raw, nodes: [], edges: [] };

  const adjacency = new Map();
  const connect = (left, right) => {
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    adjacency.get(left).add(right);
  };
  for (const edge of edges) {
    connect(edge.src, edge.dst);
    connect(edge.dst, edge.src);
  }

  const keepIds = new Set(anchorIds);
  const queue = [...anchorIds];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of adjacency.get(current) ?? []) {
      if (keepIds.has(neighbor)) continue;
      keepIds.add(neighbor);
      queue.push(neighbor);
    }
  }

  return {
    ...raw,
    nodes: nodes.filter((node) => keepIds.has(node.id)),
    edges: edges.filter((edge) => keepIds.has(edge.src) && keepIds.has(edge.dst))
  };
}

export function summarizeDataflowResult(raw, metadata = {}) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw?.edges) ? raw.edges : [];
  return {
    command: "dataflow",
    ...metadata,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    slice: raw
  };
}

async function ensureCurrentCpg() {
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
    fail(`CPG is ${status.status}${reasons}. Run npm run context:cpg:build before slicing it.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const mode = args.shift();
  if (!supportedModes.has(mode)) fail(`Unsupported slice mode: ${mode}`);

  const query = args.shift();
  if (!query || query.startsWith("--")) fail(`${mode} requires a ${mode === "usages" ? "variable" : "sink"}`);

  let depth = 8;
  let method = null;
  let file = null;
  let regex = false;
  let includeSource = false;
  let excludeOperators = false;
  let endAtExternalMethod = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--depth": {
        const value = Number.parseInt(optionValue(args, index, "--depth"), 10);
        if (!Number.isInteger(value) || value < 1 || value > 20) fail("--depth must be an integer between 1 and 20");
        depth = value;
        index += 1;
        break;
      }
      case "--method":
        method = optionValue(args, index, "--method");
        index += 1;
        break;
      case "--file":
        file = optionValue(args, index, "--file");
        index += 1;
        break;
      case "--regex":
        regex = true;
        break;
      case "--include-source":
        includeSource = true;
        break;
      case "--exclude-operators":
        excludeOperators = true;
        break;
      case "--end-at-external-method":
        endAtExternalMethod = true;
        break;
      default:
        fail(`Unexpected argument: ${arg}`);
    }
  }

  if (mode === "usages" && regex) fail("--regex is only supported by dataflow");
  if (mode === "usages" && endAtExternalMethod) fail("--end-at-external-method is only supported by dataflow");
  if (mode === "dataflow" && includeSource) fail("--include-source is only supported by usages");
  if (mode === "dataflow" && excludeOperators) fail("--exclude-operators is only supported by usages");

  await ensureCurrentCpg();

  let joernSlice;
  try {
    joernSlice = await resolveJoernTool(repoRoot, "joern-slice", "JOERN_SLICE_BIN");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const cpgFile = path.join(repoRoot, ".context/cpg/cpg.bin");
  const cacheRoot = path.join(repoRoot, ".context/cache/slices");
  await mkdir(cacheRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(cacheRoot, `${mode}-`));
  const outputFile = path.join(tempDir, "slices.json");

  try {
    // Joern v4.0.625 resets shared CLI options when a slice subcommand is selected.
    // Run in an isolated cwd so its default slices.json is deterministic, and apply
    // shared method/file filters after parsing the JSON instead of trusting the CLI.
    const sliceArgs = [mode === "dataflow" ? "data-flow" : "usages"];

    if (mode === "usages") {
      if (!includeSource) sliceArgs.push("--exclude-source");
      if (excludeOperators) sliceArgs.push("--exclude-operators");
    } else {
      const sinkFilter = regex ? query : `.*${escapeRegex(query)}.*`;
      sliceArgs.push("--slice-depth", String(depth), "--sink-filter", sinkFilter);
      if (endAtExternalMethod) sliceArgs.push("--end-at-external-method");
    }

    sliceArgs.push(cpgFile);

    const sliceRun = spawnSync(joernSlice, sliceArgs, {
      cwd: tempDir,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024
    });

    if (sliceRun.status !== 0) {
      fail(sliceRun.stderr.trim() || sliceRun.stdout.trim() || `joern-slice exited with code ${sliceRun.status}`);
    }

    const rawText = await readFile(outputFile, "utf8").catch(() => null);
    let raw;

    if (!rawText) {
      raw = interpretMissingSliceOutput(mode, sliceRun.stdout, sliceRun.stderr);
      if (!raw) {
        fail(formatMissingSliceDiagnostic({
          mode,
          query,
          method,
          file,
          stdout: sliceRun.stdout,
          stderr: sliceRun.stderr
        }));
      }
    } else {
      try {
        raw = JSON.parse(rawText);
      } catch {
        fail(`joern-slice produced invalid JSON: ${rawText.slice(0, 500)}`);
      }
    }

    const result = mode === "usages"
      ? {
          ...filterUsageResult(raw, query, includeSource, { method, file }),
          filters: { method, file, includeSource, excludeOperators }
        }
      : summarizeDataflowResult(filterDataflowScope(raw, { method, file }), {
          sink: query,
          depth,
          filters: { method, file, regex, endAtExternalMethod }
        });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptFile;
if (isMain) await main();

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveJoernTool } from "./joern-runtime.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptFile), "../..");
const cpgFile = path.join(repoRoot, ".context/cpg/cpg.bin");
const emptySliceMarker = "Empty slice, no file generated.";

function runJson(label, script, args) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON: ${result.stdout.slice(0, 500)}`);
  }
}

function isStableCallName(value) {
  return /^[A-Za-z_$][\w$]*$/.test(String(value ?? ""));
}

export function selectUsageProbe(raw) {
  const methods = Array.isArray(raw?.objectSlices) ? raw.objectSlices : [];
  let usage = null;
  let dataflowCall = null;

  for (const method of methods) {
    const slices = Array.isArray(method?.slices) ? method.slices : [];
    for (const slice of slices) {
      const variable = slice?.targetObj?.name ?? slice?.definedBy?.name;
      if (!usage && variable && method?.fullName) {
        usage = { variable, methodFullName: method.fullName };
      }

      if (!dataflowCall) {
        const calls = [
          ...(Array.isArray(slice?.argToCalls) ? slice.argToCalls : []),
          ...(Array.isArray(slice?.invokedCalls) ? slice.invokedCalls : [])
        ];
        const call = calls.find((candidate) => isStableCallName(candidate?.callName));
        if (call) dataflowCall = call.callName;
      }

      if (usage && dataflowCall) return { usage, dataflowCall };
    }
  }

  return { usage, dataflowCall };
}

async function readRawUsageSlice() {
  const joernSlice = await resolveJoernTool(repoRoot, "joern-slice", "JOERN_SLICE_BIN");
  const cacheRoot = path.join(repoRoot, ".context/cache/smoke");
  await mkdir(cacheRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(cacheRoot, "usages-"));

  try {
    const result = spawnSync(joernSlice, ["usages", "--min-num-calls", "0", "--exclude-source", cpgFile], {
      cwd: tempDir,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024
    });

    if (result.status !== 0) {
      throw new Error(
        `raw usages probe failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`
      );
    }

    const rawText = await readFile(path.join(tempDir, "slices.json"), "utf8").catch(() => null);
    if (!rawText) {
      if (`${result.stdout}\n${result.stderr}`.includes(emptySliceMarker)) {
        throw new Error("raw usages probe returned an empty slice");
      }
      throw new Error(
        `raw usages probe produced no slices.json: ${result.stderr.trim() || result.stdout.trim() || "no output"}`
      );
    }

    return JSON.parse(rawText);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const symbol = runJson(
    "symbol query",
    "scripts/context/cpg-query.mjs",
    ["symbol", "noStoreJson"]
  );
  assert.equal(symbol.command, "symbol");
  assert.ok(symbol.matches?.length > 0, "noStoreJson must be present in the generated CPG");

  const callees = runJson(
    "callee query",
    "scripts/context/cpg-query.mjs",
    ["callees", "roomErrorResponse"]
  );
  assert.equal(callees.command, "callees");
  assert.ok(callees.roots?.length > 0, "roomErrorResponse must be present in the generated CPG");
  assert.ok(
    callees.results?.some((method) => method.name === "noStoreJson"),
    "roomErrorResponse should have noStoreJson as a direct CPG callee"
  );

  const rawUsage = await readRawUsageSlice();
  const probe = selectUsageProbe(rawUsage);
  assert.ok(probe.usage, "generated usage slice must expose at least one variable or parameter target");
  assert.ok(probe.dataflowCall, "generated usage slice must expose at least one normal call for data-flow probing");

  const usages = runJson(
    "usages slice",
    "scripts/context/cpg-slice.mjs",
    ["usages", probe.usage.variable, "--method", probe.usage.methodFullName]
  );
  assert.equal(usages.command, "usages");
  assert.equal(usages.query, probe.usage.variable);
  assert.ok(usages.matchCount > 0, `discovered usage target '${probe.usage.variable}' must round-trip through the CPG slice CLI`);

  const dataflow = runJson(
    "dataflow slice",
    "scripts/context/cpg-slice.mjs",
    ["dataflow", probe.dataflowCall, "--depth", "2"]
  );
  assert.equal(dataflow.command, "dataflow");
  assert.equal(dataflow.sink, probe.dataflowCall);
  assert.ok(dataflow.nodeCount > 0, `discovered call '${probe.dataflowCall}' must produce a non-empty data-flow slice`);

  console.log(
    `CPG smoke tests passed: symbol, call graph, usages (${probe.usage.variable}) and dataflow (${probe.dataflowCall}).`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptFile;
if (isMain) await main();

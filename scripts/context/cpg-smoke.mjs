import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

const usages = runJson(
  "usages query",
  "scripts/context/cpg-slice.mjs",
  ["usages", "debugId", "--method", "roomErrorResponse"]
);
assert.equal(usages.command, "usages");
assert.equal(usages.query, "debugId");
assert.equal(usages.engine, "cpgql");
assert.ok(usages.matchCount > 0, "debugId must have identifier usages inside roomErrorResponse");
assert.ok(
  usages.methods?.some((method) => method.fullName.includes("roomErrorResponse")),
  "debugId usages must resolve back to roomErrorResponse"
);

const dataflow = runJson(
  "dataflow slice",
  "scripts/context/cpg-slice.mjs",
  ["dataflow", "debugId", "--depth", "2", "--method", "roomErrorResponse"]
);
assert.equal(dataflow.command, "dataflow");
assert.equal(dataflow.sink, "debugId");
assert.equal(dataflow.engine, "joern-slice");
assert.ok(dataflow.nodeCount > 0, "debugId must produce a non-empty data-flow slice");

console.log("CPG smoke tests passed: symbol, call graph, CPGQL usages and Joern dataflow.");

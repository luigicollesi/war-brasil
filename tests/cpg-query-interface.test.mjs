import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const queryCli = path.join(repoRoot, "scripts/context/cpg-query.mjs");
const queryScript = path.join(repoRoot, "scripts/context/joern/query.sc");

function run(...args) {
  return spawnSync(process.execPath, [queryCli, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("CPG query CLI exposes the supported agent commands without requiring Joern", () => {
  const result = run("--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /context:cpg:symbol/);
  assert.match(result.stdout, /context:cpg:callers/);
  assert.match(result.stdout, /context:cpg:callees/);
  assert.match(result.stdout, /context:cpg:impact/);
  assert.match(result.stdout, /context:cpg:path/);
});

test("CPG query CLI validates depth before touching the graph runtime", () => {
  const result = run("impact", "resolveAttack", "--depth", "0");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--depth must be an integer between 1 and 20/);
});

test("CPG path requires both endpoints before touching the graph runtime", () => {
  const result = run("path", "RealtimeClient");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /path requires both <from> and <to> symbols/);
});

test("Joern query script contains all phase 3 query modes", async () => {
  const source = await readFile(queryScript, "utf8");
  for (const mode of ["symbol", "callers", "callees", "impact", "path"]) {
    assert.match(source, new RegExp(`case "${mode}"`));
  }
  assert.match(source, /@main def exec/);
  assert.match(source, /importCpg\(cpgFile\)/);
});

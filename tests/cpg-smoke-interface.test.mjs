import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const smokePath = path.join(repoRoot, "scripts/context/cpg-smoke.mjs");

test("CPG smoke covers symbol, call graph, CPGQL usages and Joern dataflow", async () => {
  const source = await readFile(smokePath, "utf8");

  assert.match(source, /\["symbol", "noStoreJson"\]/);
  assert.match(source, /\["callees", "roomErrorResponse"\]/);
  assert.match(source, /\["usages", "debugId", "--method", "roomErrorResponse"\]/);
  assert.match(source, /assert\.equal\(usages\.engine, "cpgql"\)/);
  assert.match(source, /\["dataflow", "debugId", "--depth", "2", "--method", "roomErrorResponse"\]/);
  assert.match(source, /assert\.equal\(dataflow\.engine, "joern-slice"\)/);
  assert.match(source, /usages\.matchCount > 0/);
  assert.match(source, /dataflow\.nodeCount > 0/);
});

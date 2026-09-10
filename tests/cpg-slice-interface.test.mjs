import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  emptySliceForMode,
  filterUsageResult,
  formatMissingSliceDiagnostic,
  interpretMissingSliceOutput,
  summarizeDataflowResult
} from "../scripts/context/cpg-slice.mjs";

const repoRoot = process.cwd();
const sliceCli = path.join(repoRoot, "scripts/context/cpg-slice.mjs");

function run(...args) {
  return spawnSync(process.execPath, [sliceCli, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("CPG slice CLI exposes usages and dataflow without requiring Joern", () => {
  const result = run("--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /context:cpg:usages/);
  assert.match(result.stdout, /context:cpg:dataflow/);
});

test("CPG dataflow validates depth before touching the graph runtime", () => {
  const result = run("dataflow", "selectedTerritory", "--depth", "0");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--depth must be an integer between 1 and 20/);
});

test("CPG slice CLI rejects mode-specific flags early", () => {
  const usages = run("usages", "selectedTerritory", "--regex");
  assert.equal(usages.status, 1);
  assert.match(usages.stderr, /--regex is only supported by dataflow/);

  const dataflow = run("dataflow", "selectedTerritory", "--include-source");
  assert.equal(dataflow.status, 1);
  assert.match(dataflow.stderr, /--include-source is only supported by usages/);
});

test("usage result keeps only the requested variable and omits source by default", () => {
  const raw = {
    objectSlices: [
      {
        code: "function render(selectedTerritory) { return selectedTerritory; }",
        fullName: "render",
        fileName: "src/render.ts",
        lineNumber: 1,
        columnNumber: 1,
        slices: [
          { targetObj: { name: "selectedTerritory" }, definedBy: { name: "selectedTerritory" }, invokedCalls: [] },
          { targetObj: { name: "other" }, definedBy: { name: "other" }, invokedCalls: [] }
        ]
      }
    ],
    userDefinedTypes: []
  };

  const result = filterUsageResult(raw, "selectedTerritory");
  assert.equal(result.matchCount, 1);
  assert.equal(result.methods.length, 1);
  assert.equal(result.methods[0].slices.length, 1);
  assert.equal("code" in result.methods[0], false);

  const withSource = filterUsageResult(raw, "selectedTerritory", true);
  assert.match(withSource.methods[0].code, /selectedTerritory/);
});

test("dataflow result reports graph size without changing the slice", () => {
  const raw = {
    nodes: [{ id: 1 }, { id: 2 }],
    edges: [{ src: 1, dst: 2, label: "REACHING_DEF" }]
  };
  const result = summarizeDataflowResult(raw, { sink: "selectedTerritory", depth: 8 });
  assert.equal(result.nodeCount, 2);
  assert.equal(result.edgeCount, 1);
  assert.equal(result.slice, raw);
});

test("Joern empty-slice marker becomes a valid empty result for both slice modes", () => {
  const usages = interpretMissingSliceOutput(
    "usages",
    "Empty slice, no file generated.\n",
    ""
  );
  assert.deepEqual(usages, emptySliceForMode("usages"));
  assert.deepEqual(filterUsageResult(usages, "missing"), {
    command: "usages",
    query: "missing",
    matchCount: 0,
    methods: []
  });

  const dataflow = interpretMissingSliceOutput(
    "dataflow",
    "",
    "Empty slice, no file generated."
  );
  assert.deepEqual(dataflow, { nodes: [], edges: [] });
  assert.equal(summarizeDataflowResult(dataflow).nodeCount, 0);
});

test("missing JSON without Joern's empty marker remains an actionable error", () => {
  assert.equal(interpretMissingSliceOutput("usages", "Usage: joern-slice", "bad option"), null);
  const diagnostic = formatMissingSliceDiagnostic({
    mode: "usages",
    query: "debugId",
    method: "roomErrorResponse",
    file: null,
    stdout: "Usage: joern-slice\n".repeat(100),
    stderr: "Unknown option"
  });
  assert.match(diagnostic, /mode=usages/);
  assert.match(diagnostic, /query=debugId/);
  assert.match(diagnostic, /method=roomErrorResponse/);
  assert.match(diagnostic, /Unknown option/);
  assert.ok(diagnostic.length < 2000);
});

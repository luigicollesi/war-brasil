import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  emptySliceForMode,
  filterDataflowScope,
  filterFallbackUsages,
  filterUsageResult,
  formatMissingSliceDiagnostic,
  interpretMissingSliceOutput,
  matchesFileScope,
  matchesMethodScope,
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

test("legacy usage result keeps only the requested variable and applies method/file scope", () => {
  const raw = {
    objectSlices: [
      {
        code: "function render(selectedTerritory) { return selectedTerritory; }",
        fullName: "src/render.ts:<module>.render",
        fileName: "src/render.ts",
        lineNumber: 1,
        columnNumber: 1,
        slices: [
          { targetObj: { name: "selectedTerritory" }, definedBy: { name: "selectedTerritory" }, invokedCalls: [] },
          { targetObj: { name: "other" }, definedBy: { name: "other" }, invokedCalls: [] }
        ]
      },
      {
        code: "function other(selectedTerritory) { return selectedTerritory; }",
        fullName: "src/other.ts:<module>.other",
        fileName: "/tmp/staging/src/other.ts",
        slices: [
          { targetObj: { name: "selectedTerritory" }, definedBy: { name: "selectedTerritory" }, invokedCalls: [] }
        ]
      }
    ],
    userDefinedTypes: []
  };

  const result = filterUsageResult(raw, "selectedTerritory", false, {
    method: "render",
    file: "src/render.ts"
  });
  assert.equal(result.matchCount, 1);
  assert.equal(result.methods.length, 1);
  assert.equal(result.methods[0].slices.length, 1);
  assert.equal("code" in result.methods[0], false);

  const withSource = filterUsageResult(raw, "selectedTerritory", true, { method: "render" });
  assert.match(withSource.methods[0].code, /selectedTerritory/);
  assert.equal(matchesMethodScope("src/render.ts:<module>.render", "render"), true);
  assert.equal(matchesMethodScope("src/render.ts:<module>.render", "other"), false);
  assert.equal(matchesFileScope("/tmp/staging/src/render.ts", "src/render.ts"), true);
});

test("CPGQL usages fallback groups identifier references and preserves scope/source controls", () => {
  const raw = {
    command: "usages",
    query: "debugId",
    declarationCount: 1,
    usageCount: 3,
    usages: [
      {
        id: 1,
        code: "debugId",
        line: 10,
        column: 3,
        method: "roomErrorResponse",
        methodFullName: "src/lib/api-response.ts::program:roomErrorResponse",
        methodCode: "function roomErrorResponse() { const debugId = makeId(); return debugId; }",
        file: "src/lib/api-response.ts",
        call: "<operator>.assignment",
        callCode: "debugId = makeId()"
      },
      {
        id: 2,
        code: "debugId",
        line: 11,
        column: 10,
        method: "roomErrorResponse",
        methodFullName: "src/lib/api-response.ts::program:roomErrorResponse",
        methodCode: "function roomErrorResponse() { const debugId = makeId(); return debugId; }",
        file: "src/lib/api-response.ts",
        call: "noStoreJson",
        callCode: "noStoreJson({ debugId })"
      },
      {
        id: 3,
        code: "debugId",
        line: 20,
        column: 5,
        method: "other",
        methodFullName: "src/other.ts::program:other",
        methodCode: "function other(debugId) { return debugId; }",
        file: "src/other.ts",
        call: "<operator>.assignment",
        callCode: "value = debugId"
      }
    ]
  };

  const result = filterFallbackUsages(raw, true, {
    method: "roomErrorResponse",
    file: "src/lib/api-response.ts"
  });
  assert.equal(result.query, "debugId");
  assert.equal(result.declarationCount, 1);
  assert.equal(result.matchCount, 2);
  assert.equal(result.methods.length, 1);
  assert.equal(result.methods[0].usages.length, 2);
  assert.match(result.methods[0].code, /roomErrorResponse/);
});

test("dataflow scope preserves the connected interprocedural component", () => {
  const raw = {
    nodes: [
      { id: 1, parentMethod: "src/api.ts:<module>.handler", parentFile: "src/api.ts" },
      { id: 2, parentMethod: "src/service.ts:<module>.service", parentFile: "src/service.ts" },
      { id: 3, parentMethod: "src/other.ts:<module>.other", parentFile: "src/other.ts" },
      { id: 4, parentMethod: "src/unrelated.ts:<module>.unrelated", parentFile: "src/unrelated.ts" }
    ],
    edges: [
      { src: 2, dst: 1, label: "REACHING_DEF" },
      { src: 3, dst: 2, label: "REACHING_DEF" }
    ]
  };

  const scoped = filterDataflowScope(raw, { method: "handler", file: "src/api.ts" });
  assert.deepEqual(scoped.nodes.map((node) => node.id).sort(), [1, 2, 3]);
  assert.equal(scoped.edges.length, 2);

  const missing = filterDataflowScope(raw, { method: "doesNotExist" });
  assert.deepEqual(missing.nodes, []);
  assert.deepEqual(missing.edges, []);
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
  const usages = interpretMissingSliceOutput("usages", "Empty slice, no file generated.\n", "");
  assert.deepEqual(usages, emptySliceForMode("usages"));
  assert.deepEqual(filterUsageResult(usages, "missing"), {
    command: "usages",
    query: "missing",
    matchCount: 0,
    methods: []
  });

  const dataflow = interpretMissingSliceOutput("dataflow", "", "Empty slice, no file generated.");
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

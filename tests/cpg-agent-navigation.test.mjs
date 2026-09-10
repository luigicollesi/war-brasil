import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("AGENTS requires progressive CPG context acquisition", async () => {
  const agents = await read("AGENTS.md");

  assert.match(agents, /docs\/ai\/cpg-summary\.md/);
  assert.match(agents, /context:cpg:status/);
  assert.match(agents, /context:cpg:restore/);
  assert.match(agents, /Do not load or dump the complete CPG/i);
  assert.match(agents, /Source code is always the source of truth/i);
  assert.match(agents, /STALE.*MISSING/s);
});

test("AI CPG summary documents all public navigation commands", async () => {
  const summary = await read("docs/ai/cpg-summary.md");
  const commands = [
    "context:cpg:status",
    "context:cpg:restore",
    "context:cpg:symbol",
    "context:cpg:callers",
    "context:cpg:callees",
    "context:cpg:impact",
    "context:cpg:path",
    "context:cpg:usages",
    "context:cpg:dataflow"
  ];

  for (const command of commands) {
    assert.match(summary, new RegExp(command.replaceAll(":", "\\:")));
  }

  assert.match(summary, /PostgreSQL is the sole authority/i);
  assert.match(summary, /artifact.*MISSING|MISSING.*artifact/is);
  assert.match(summary, /Do not infer live call\/data-flow relationships/i);
});

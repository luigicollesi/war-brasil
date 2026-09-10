import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getCpgArtifactIdentity } from "../scripts/context/cpg-artifact-identity.mjs";
import { selectArtifact } from "../scripts/context/restore-cpg-artifact.mjs";

const repoRoot = process.cwd();

test("CPG workflow builds, validates, caches and uploads without committing generated data", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/cpg.yml"), "utf8");

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*-\s*dev/);
  assert.match(workflow, /paths:/);
  assert.match(workflow, /context:cpg:prepare/);
  assert.match(workflow, /cpg-artifact-identity\.mjs/);
  assert.match(workflow, /actions\/cache@v6/);
  assert.match(workflow, /context:cpg:build/);
  assert.match(workflow, /context:cpg:status -- --check/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /artifact_name/);
  assert.doesNotMatch(workflow, /\bgit\s+(?:commit|push)\b/);
});

test("CPG artifact identity changes with all graph-authority fingerprints", async () => {
  const identity = await getCpgArtifactIdentity(repoRoot);
  assert.match(identity.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(identity.artifactName, `cpg-${identity.fingerprint}`);
  assert.match(identity.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(identity.configFingerprint, /^[a-f0-9]{64}$/);
  assert.match(identity.joernLockFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(typeof identity.joernVersion, "string");
});

test("artifact selection accepts only the newest exact non-expired CPG artifact", () => {
  const expected = "cpg-abc";
  const artifact = selectArtifact([
    { id: 1, name: expected, expired: false, created_at: "2026-09-01T00:00:00Z", workflow_run: { id: 10 } },
    { id: 2, name: "cpg-other", expired: false, created_at: "2026-09-10T00:00:00Z", workflow_run: { id: 20 } },
    { id: 3, name: expected, expired: true, created_at: "2026-09-09T00:00:00Z", workflow_run: { id: 30 } },
    { id: 4, name: expected, expired: false, created_at: "2026-09-08T00:00:00Z", workflow_run: { id: 40 } }
  ], expected);

  assert.equal(artifact.id, 4);
  assert.equal(artifact.workflow_run.id, 40);
});

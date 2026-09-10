import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getCpgArtifactIdentity } from "../scripts/context/cpg-artifact-identity.mjs";
import {
  selectArtifact,
  validateArtifactMetadata
} from "../scripts/context/restore-cpg-artifact.mjs";

const repoRoot = process.cwd();

test("CPG workflow builds, validates, smoke-tests, caches and uploads only on a CPG cache miss", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/cpg.yml"), "utf8");

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*-\s*dev/);
  assert.match(workflow, /paths:/);
  assert.match(workflow, /context:cpg:prepare/);
  assert.match(workflow, /cpg-artifact-identity\.mjs/);
  assert.match(workflow, /actions\/cache@v6/);
  assert.match(workflow, /joern-runtime-v2-/);
  assert.match(workflow, /\.context\/cache\/joern\/\$\{\{\s*steps\.identity\.outputs\.joern_version\s*\}\}/);
  assert.match(workflow, /Validate restored CPG cache/);
  assert.match(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /steps\.cpg-cache-validation\.outcome\s*!=\s*'success'/);
  assert.match(workflow, /context:cpg:build/);
  assert.match(workflow, /context:cpg:status -- --check/);
  assert.match(workflow, /context:cpg:smoke/);
  assert.match(workflow, /Upload CPG artifact\s*\n\s*if:\s*steps\.cpg-cache\.outputs\.cache-hit\s*!=\s*'true'/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /artifact_name/);
  assert.doesNotMatch(workflow, /\bgit\s+(?:commit|push)\b/);
});

test("CPG artifact identity includes all graph-authority fingerprints", async () => {
  const identity = await getCpgArtifactIdentity(repoRoot);
  assert.equal(identity.schemaVersion, 2);
  assert.match(identity.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(identity.artifactName, `cpg-${identity.fingerprint}`);
  assert.match(identity.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(identity.configFingerprint, /^[a-f0-9]{64}$/);
  assert.match(identity.generatorFingerprint, /^[a-f0-9]{64}$/);
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

test("artifact restore metadata rejects generator mismatch and cpg.bin corruption before installation", () => {
  const identity = {
    sourceFingerprint: "1".repeat(64),
    configFingerprint: "2".repeat(64),
    generatorFingerprint: "3".repeat(64),
    joernLockFingerprint: "4".repeat(64),
    joernVersion: "v-test"
  };
  const actualCpgSha256 = "5".repeat(64);
  const metadata = {
    schemaVersion: 3,
    generator: "joern",
    version: identity.joernVersion,
    sourceFingerprint: identity.sourceFingerprint,
    configFingerprint: identity.configFingerprint,
    generatorFingerprint: identity.generatorFingerprint,
    joernLockFingerprint: identity.joernLockFingerprint,
    cpgSha256: actualCpgSha256,
    fileCount: 1,
    fileHashes: { "src/game.ts": "6".repeat(64) },
    generatorFileHashes: { "scripts/context/build-cpg.sh": "7".repeat(64) }
  };

  assert.equal(validateArtifactMetadata(metadata, identity, actualCpgSha256), null);
  assert.match(
    validateArtifactMetadata(
      { ...metadata, generatorFingerprint: "8".repeat(64) },
      identity,
      actualCpgSha256
    ),
    /generator fingerprint/
  );
  assert.match(
    validateArtifactMetadata(metadata, identity, "9".repeat(64)),
    /checksum/
  );
});

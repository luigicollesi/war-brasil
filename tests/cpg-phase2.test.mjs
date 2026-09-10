import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fingerprintJsonFile, getCpgSourceState } from "../scripts/context/cpg-source.mjs";

const repoRoot = process.cwd();
const statusScript = path.join(repoRoot, "scripts/context/cpg-status.mjs");

async function createFixture() {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "war-brasil-cpg-status-"));
  await mkdir(path.join(fixture, ".context/cpg"), { recursive: true });
  await mkdir(path.join(fixture, "src"), { recursive: true });
  await writeFile(path.join(fixture, ".context/cpg.config.json"), JSON.stringify({
    version: 1,
    roots: ["src"],
    extensions: [".ts"],
    exclude: ["**/*.test.*"],
    supportFiles: [],
    generated: { cpgDirectory: ".context/cpg", cacheDirectory: ".context/cache" }
  }, null, 2));
  await writeFile(path.join(fixture, ".context/joern.lock.json"), JSON.stringify({ version: "v-test", assets: {} }, null, 2));
  await writeFile(path.join(fixture, "src/game.ts"), "export const game = 1;\n");
  return fixture;
}

function runStatus(fixture, ...flags) {
  return spawnSync(process.execPath, [statusScript, fixture, ...flags], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("CPG status distinguishes MISSING, CURRENT and STALE from source content", async () => {
  const fixture = await createFixture();
  try {
    let result = runStatus(fixture, "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "MISSING");

    const state = await getCpgSourceState(fixture);
    const joernLockFingerprint = await fingerprintJsonFile(path.join(fixture, ".context/joern.lock.json"));
    await writeFile(path.join(fixture, ".context/cpg/cpg.bin"), "fake-cpg");
    await writeFile(path.join(fixture, ".context/cpg/build.json"), JSON.stringify({
      schemaVersion: 2,
      generator: "joern",
      version: "v-test",
      commit: "fixture",
      sourceFingerprint: state.sourceFingerprint,
      configFingerprint: state.configFingerprint,
      joernLockFingerprint,
      fileCount: state.fileCount,
      fileHashes: state.fileHashes
    }, null, 2));

    result = runStatus(fixture, "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "CURRENT");

    await writeFile(path.join(fixture, "src/game.ts"), "export const game = 2;\n");
    result = runStatus(fixture, "--json");
    const stale = JSON.parse(result.stdout);
    assert.equal(stale.status, "STALE");
    assert.ok(stale.reasons.includes("source_changed"));
    assert.deepEqual(stale.changedFiles.modified, ["src/game.ts"]);

    result = runStatus(fixture, "--check");
    assert.equal(result.status, 1);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CPG source fingerprint changes when file contents change without renaming files", async () => {
  const fixture = await createFixture();
  try {
    const before = await getCpgSourceState(fixture);
    await writeFile(path.join(fixture, "src/game.ts"), "export const game = 99;\n");
    const after = await getCpgSourceState(fixture);
    assert.deepEqual(after.files, before.files);
    assert.notEqual(after.sourceFingerprint, before.sourceFingerprint);
    assert.notEqual(after.fileHashes["src/game.ts"], before.fileHashes["src/game.ts"]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CPG status detects configuration and Joern lock drift", async () => {
  const fixture = await createFixture();
  try {
    const state = await getCpgSourceState(fixture);
    const lockPath = path.join(fixture, ".context/joern.lock.json");
    const configPath = path.join(fixture, ".context/cpg.config.json");
    const joernLockFingerprint = await fingerprintJsonFile(lockPath);
    await writeFile(path.join(fixture, ".context/cpg/cpg.bin"), "fake-cpg");
    await writeFile(path.join(fixture, ".context/cpg/build.json"), JSON.stringify({
      schemaVersion: 2,
      generator: "joern",
      version: "v-test",
      commit: "fixture",
      sourceFingerprint: state.sourceFingerprint,
      configFingerprint: state.configFingerprint,
      joernLockFingerprint,
      fileCount: state.fileCount,
      fileHashes: state.fileHashes
    }, null, 2));

    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.extensions.push(".js");
    await writeFile(configPath, JSON.stringify(config, null, 2));
    let result = JSON.parse(runStatus(fixture, "--json").stdout);
    assert.equal(result.status, "STALE");
    assert.ok(result.reasons.includes("config_changed"));

    config.extensions.pop();
    await writeFile(configPath, JSON.stringify(config, null, 2));
    await writeFile(lockPath, JSON.stringify({ version: "v-test-2", assets: {} }, null, 2));
    result = JSON.parse(runStatus(fixture, "--json").stdout);
    assert.equal(result.status, "STALE");
    assert.ok(result.reasons.includes("joern_version_changed"));
    assert.ok(result.reasons.includes("joern_lock_changed"));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  fingerprintFile,
  fingerprintJsonFile,
  getCpgGeneratorState,
  getCpgSourceState
} from "../scripts/context/cpg-source.mjs";

const repoRoot = process.cwd();
const statusScript = path.join(repoRoot, "scripts/context/cpg-status.mjs");

async function createFixture() {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "war-brasil-cpg-status-"));
  await mkdir(path.join(fixture, ".context/cpg"), { recursive: true });
  await mkdir(path.join(fixture, "src"), { recursive: true });
  await mkdir(path.join(fixture, "scripts/context"), { recursive: true });
  await writeFile(path.join(fixture, ".context/cpg.config.json"), JSON.stringify({
    version: 1,
    roots: ["src"],
    extensions: [".ts"],
    exclude: ["**/*.test.*"],
    supportFiles: [],
    generatorFiles: ["scripts/context/fake-generator.mjs"],
    generated: { cpgDirectory: ".context/cpg", cacheDirectory: ".context/cache" }
  }, null, 2));
  await writeFile(path.join(fixture, ".context/joern.lock.json"), JSON.stringify({ version: "v-test", assets: {} }, null, 2));
  await writeFile(path.join(fixture, "src/game.ts"), "export const game = 1;\n");
  await writeFile(path.join(fixture, "scripts/context/fake-generator.mjs"), "export const generator = 1;\n");
  return fixture;
}

function runStatus(fixture, ...flags) {
  return spawnSync(process.execPath, [statusScript, fixture, ...flags], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

async function writeCurrentBuild(fixture, cpgContent = "fake-cpg") {
  const state = await getCpgSourceState(fixture);
  const generator = await getCpgGeneratorState(fixture, state.config);
  const lockPath = path.join(fixture, ".context/joern.lock.json");
  const cpgPath = path.join(fixture, ".context/cpg/cpg.bin");
  const joernLockFingerprint = await fingerprintJsonFile(lockPath);

  await writeFile(cpgPath, cpgContent);
  const cpgSha256 = await fingerprintFile(cpgPath);
  await writeFile(path.join(fixture, ".context/cpg/build.json"), JSON.stringify({
    schemaVersion: 3,
    generator: "joern",
    version: "v-test",
    commit: "fixture",
    sourceFingerprint: state.sourceFingerprint,
    configFingerprint: state.configFingerprint,
    generatorFingerprint: generator.generatorFingerprint,
    generatorFileHashes: generator.generatorFileHashes,
    joernLockFingerprint,
    cpgSha256,
    fileCount: state.fileCount,
    fileHashes: state.fileHashes
  }, null, 2));

  return { state, generator, cpgSha256 };
}

test("CPG status distinguishes MISSING, CURRENT and STALE from source content", async () => {
  const fixture = await createFixture();
  try {
    let result = runStatus(fixture, "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "MISSING");

    await writeCurrentBuild(fixture);

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
    await writeCurrentBuild(fixture);
    const lockPath = path.join(fixture, ".context/joern.lock.json");
    const configPath = path.join(fixture, ".context/cpg.config.json");

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

test("CPG status detects generator implementation drift", async () => {
  const fixture = await createFixture();
  try {
    await writeCurrentBuild(fixture);
    await writeFile(
      path.join(fixture, "scripts/context/fake-generator.mjs"),
      "export const generator = 2;\n"
    );

    const result = JSON.parse(runStatus(fixture, "--json").stdout);
    assert.equal(result.status, "STALE");
    assert.ok(result.reasons.includes("generator_implementation_changed"));
    assert.deepEqual(result.changedGeneratorFiles.modified, ["scripts/context/fake-generator.mjs"]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CPG status detects cpg.bin integrity drift", async () => {
  const fixture = await createFixture();
  try {
    await writeCurrentBuild(fixture);
    await writeFile(path.join(fixture, ".context/cpg/cpg.bin"), "tampered-cpg");

    const result = JSON.parse(runStatus(fixture, "--json").stdout);
    assert.equal(result.status, "STALE");
    assert.ok(result.reasons.includes("cpg_checksum_changed"));
    assert.notEqual(result.currentCpgSha256, result.builtCpgSha256);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CPG metadata writer binds schema, generator implementation and cpg.bin checksum", async () => {
  const fixture = await createFixture();
  try {
    const state = await getCpgSourceState(fixture);
    const manifestPath = path.join(fixture, ".context/manifest.json");
    const cpgPath = path.join(fixture, ".context/cpg/cpg.bin");
    const outputPath = path.join(fixture, ".context/cpg/build.json");
    await writeFile(manifestPath, JSON.stringify({
      fileCount: state.fileCount,
      sourceFingerprint: state.sourceFingerprint,
      configFingerprint: state.configFingerprint,
      files: state.files,
      fileHashes: state.fileHashes
    }, null, 2));
    await writeFile(cpgPath, "writer-cpg");

    const writer = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts/context/write-cpg-build-metadata.mjs"),
      fixture,
      manifestPath,
      cpgPath,
      outputPath,
      "v-test",
      "fixture-commit"
    ], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    assert.equal(writer.status, 0, writer.stderr);

    const metadata = JSON.parse(await readFile(outputPath, "utf8"));
    const generator = await getCpgGeneratorState(fixture, state.config);
    assert.equal(metadata.schemaVersion, 3);
    assert.equal(metadata.generator, "joern");
    assert.equal(metadata.version, "v-test");
    assert.equal(metadata.commit, "fixture-commit");
    assert.match(metadata.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(metadata.sourceFingerprint, state.sourceFingerprint);
    assert.equal(metadata.configFingerprint, state.configFingerprint);
    assert.equal(metadata.generatorFingerprint, generator.generatorFingerprint);
    assert.deepEqual(metadata.generatorFileHashes, generator.generatorFileHashes);
    assert.equal(metadata.cpgSha256, await fingerprintFile(cpgPath));
    assert.deepEqual(metadata.files, state.files);
    assert.deepEqual(metadata.fileHashes, state.fileHashes);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("legacy CPG metadata is rejected as STALE instead of being trusted or crashing", async () => {
  const fixture = await createFixture();
  try {
    const state = await getCpgSourceState(fixture);
    const joernLockFingerprint = await fingerprintJsonFile(path.join(fixture, ".context/joern.lock.json"));
    await writeFile(path.join(fixture, ".context/cpg/cpg.bin"), "legacy-cpg");
    await writeFile(path.join(fixture, ".context/cpg/build.json"), JSON.stringify({
      schemaVersion: 2,
      generator: "joern",
      version: "v-test",
      sourceFingerprint: state.sourceFingerprint,
      configFingerprint: state.configFingerprint,
      joernLockFingerprint,
      fileCount: state.fileCount,
      fileHashes: state.fileHashes
    }, null, 2));

    const result = runStatus(fixture, "--json");
    assert.equal(result.status, 0, result.stderr);
    const status = JSON.parse(result.stdout);
    assert.equal(status.status, "STALE");
    assert.ok(status.reasons.includes("metadata_schema_changed"));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

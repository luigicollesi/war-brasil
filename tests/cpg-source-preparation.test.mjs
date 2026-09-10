import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const prepareScript = path.join(repoRoot, "scripts/context/prepare-cpg-source.mjs");
const buildScript = path.join(repoRoot, "scripts/context/build-cpg.sh");
const repoConfig = path.join(repoRoot, ".context/cpg.config.json");

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

test("CPG source staging keeps runtime code and excludes tests/context tooling", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "war-brasil-cpg-"));
  const output = path.join(fixture, ".context/cache/cpg-source");

  try {
    await mkdir(path.join(fixture, ".context"), { recursive: true });
    await cp(repoConfig, path.join(fixture, ".context/cpg.config.json"));
    await mkdir(path.join(fixture, "src/game"), { recursive: true });
    await mkdir(path.join(fixture, "realtime/test"), { recursive: true });
    await mkdir(path.join(fixture, "worker/test"), { recursive: true });
    await mkdir(path.join(fixture, "scripts/context"), { recursive: true });

    await writeFile(path.join(fixture, "src/game/engine.ts"), "export const engine = true;\n");
    await writeFile(path.join(fixture, "src/game/engine.test.ts"), "export const testOnly = true;\n");
    await writeFile(path.join(fixture, "realtime/server.mjs"), "export const realtime = true;\n");
    await writeFile(path.join(fixture, "realtime/test/server.test.mjs"), "export const testOnly = true;\n");
    await writeFile(path.join(fixture, "worker/server.mjs"), "export const worker = true;\n");
    await writeFile(path.join(fixture, "worker/test/server.test.mjs"), "export const testOnly = true;\n");
    await writeFile(path.join(fixture, "scripts/dev.mjs"), "export const script = true;\n");
    await writeFile(path.join(fixture, "scripts/context/internal.mjs"), "export const contextTool = true;\n");
    await writeFile(path.join(fixture, "package.json"), "{}\n");
    await writeFile(path.join(fixture, "tsconfig.json"), "{}\n");

    const result = spawnSync(process.execPath, [prepareScript, fixture, output], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(await exists(path.join(output, "src/game/engine.ts")), true);
    assert.equal(await exists(path.join(output, "realtime/server.mjs")), true);
    assert.equal(await exists(path.join(output, "worker/server.mjs")), true);
    assert.equal(await exists(path.join(output, "scripts/dev.mjs")), true);
    assert.equal(await exists(path.join(output, "src/game/engine.test.ts")), false);
    assert.equal(await exists(path.join(output, "realtime/test/server.test.mjs")), false);
    assert.equal(await exists(path.join(output, "worker/test/server.test.mjs")), false);
    assert.equal(await exists(path.join(output, "scripts/context/internal.mjs")), false);

    const manifest = JSON.parse(await readFile(path.join(output, ".manifest.json"), "utf8"));
    assert.ok(manifest.fileCount >= 4);
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(typeof manifest.sourceFingerprint, "string");
    assert.equal(typeof manifest.configFingerprint, "string");
    assert.equal(typeof manifest.fileHashes["src/game/engine.ts"], "string");
    assert.equal("scripts/context/internal.mjs" in manifest.fileHashes, false);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("CPG build script is valid bash and keeps bootstrap diagnostics off stdout", async () => {
  const result = spawnSync("bash", ["-n", buildScript], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const source = await readFile(buildScript, "utf8");
  assert.match(
    source,
    /The verified archive is removed after extraction\.\\n' "\$JOERN_VERSION" "\$key" >&2/
  );
  assert.match(source, /rm -f "\$archive\.part"/);
  assert.match(source, /rm -f "\$archive"\s*\n\s*printf '%s' "\$parser"/);
});

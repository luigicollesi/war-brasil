import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fingerprintJsonFile, getCpgSourceState, sha256 } from "./cpg-source.mjs";

const scriptFile = fileURLToPath(import.meta.url);

export async function getCpgArtifactIdentity(repoRoot) {
  const absoluteRoot = path.resolve(repoRoot);
  const state = await getCpgSourceState(absoluteRoot);
  const lockPath = path.join(absoluteRoot, ".context/joern.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const joernLockFingerprint = await fingerprintJsonFile(lockPath);
  const fingerprint = sha256([
    "war-brasil-cpg-artifact-v1",
    state.sourceFingerprint,
    state.configFingerprint,
    joernLockFingerprint,
    lock.version ?? ""
  ].join("\0"));

  return {
    schemaVersion: 1,
    fingerprint,
    artifactName: `cpg-${fingerprint}`,
    sourceFingerprint: state.sourceFingerprint,
    configFingerprint: state.configFingerprint,
    joernLockFingerprint,
    joernVersion: lock.version ?? null
  };
}

async function main() {
  const repoRoot = process.cwd();
  const identity = await getCpgArtifactIdentity(repoRoot);
  const outputIndex = process.argv.indexOf("--github-output");

  if (outputIndex >= 0) {
    const outputPath = process.argv[outputIndex + 1];
    if (!outputPath) throw new Error("--github-output requires a file path");
    await appendFile(
      outputPath,
      [
        `fingerprint=${identity.fingerprint}`,
        `artifact_name=${identity.artifactName}`,
        `source=${identity.sourceFingerprint}`,
        `config=${identity.configFingerprint}`,
        `joern_lock=${identity.joernLockFingerprint}`,
        `joern_version=${identity.joernVersion ?? ""}`
      ].join("\n") + "\n"
    );
  }

  if (!process.argv.includes("--quiet")) {
    process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptFile;
if (isMain) await main();

import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getCpgArtifactIdentity } from "./cpg-artifact-identity.mjs";
import { fingerprintFile } from "./cpg-source.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptFile), "../..");

function fail(message) {
  console.error(`CPG restore error: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
}

export function selectArtifact(artifacts, expectedName) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .filter((artifact) =>
      artifact?.name === expectedName &&
      artifact?.expired !== true &&
      Number.isInteger(artifact?.id) &&
      Number.isInteger(artifact?.workflow_run?.id)
    )
    .sort((left, right) =>
      Date.parse(right?.created_at ?? 0) - Date.parse(left?.created_at ?? 0)
    )[0] ?? null;
}

export function validateArtifactMetadata(metadata, identity, actualCpgSha256) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "build.json must contain a JSON object";
  }
  if (metadata.schemaVersion !== 3) {
    return `unsupported build metadata schema: ${String(metadata.schemaVersion)}`;
  }
  if (metadata.generator !== "joern") {
    return `unexpected generator: ${String(metadata.generator)}`;
  }
  if (metadata.version !== identity.joernVersion) {
    return "Joern version does not match the requested artifact identity";
  }
  if (metadata.sourceFingerprint !== identity.sourceFingerprint) {
    return "source fingerprint does not match the requested artifact identity";
  }
  if (metadata.configFingerprint !== identity.configFingerprint) {
    return "configuration fingerprint does not match the requested artifact identity";
  }
  if (metadata.generatorFingerprint !== identity.generatorFingerprint) {
    return "generator fingerprint does not match the requested artifact identity";
  }
  if (metadata.joernLockFingerprint !== identity.joernLockFingerprint) {
    return "Joern lock fingerprint does not match the requested artifact identity";
  }
  if (!/^[a-f0-9]{64}$/.test(metadata.cpgSha256 ?? "")) {
    return "build metadata does not contain a valid cpg.bin SHA-256";
  }
  if (metadata.cpgSha256 !== actualCpgSha256) {
    return "cpg.bin checksum does not match build metadata";
  }
  if (!Number.isInteger(metadata.fileCount) || metadata.fileCount < 1) {
    return "build metadata contains an invalid source file count";
  }
  if (!metadata.fileHashes || typeof metadata.fileHashes !== "object" || Array.isArray(metadata.fileHashes)) {
    return "build metadata does not contain source file hashes";
  }
  if (!metadata.generatorFileHashes || typeof metadata.generatorFileHashes !== "object" || Array.isArray(metadata.generatorFileHashes)) {
    return "build metadata does not contain generator file hashes";
  }
  return null;
}

async function findFile(root, basename, depth = 0) {
  if (depth > 4) return null;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const current = path.join(root, entry.name);
    if (entry.isFile() && entry.name === basename) return current;
    if (entry.isDirectory()) {
      const nested = await findFile(current, basename, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function readStatus() {
  const result = run(process.execPath, [path.join(repoRoot, "scripts/context/cpg-status.mjs"), "--json"]);
  if (!result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function resolveRepository() {
  if (process.env.GITHUB_REPOSITORY?.includes("/")) {
    return process.env.GITHUB_REPOSITORY;
  }

  const result = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  if (result.status !== 0 || !result.stdout.trim()) {
    fail("Unable to resolve the GitHub repository. Set GITHUB_REPOSITORY=owner/repo or authenticate GitHub CLI.");
  }
  return result.stdout.trim();
}

async function main() {
  const existing = readStatus();
  if (existing?.status === "CURRENT") {
    console.log("CPG is already CURRENT; no artifact restore is needed.");
    return;
  }

  const ghCheck = run("gh", ["--version"]);
  if (ghCheck.status !== 0) {
    fail("GitHub CLI (gh) is required to restore CI artifacts. Install/authenticate gh or build the CPG locally.");
  }

  const identity = await getCpgArtifactIdentity(repoRoot);
  const repository = resolveRepository();
  const endpoint = `repos/${repository}/actions/artifacts?name=${encodeURIComponent(identity.artifactName)}&per_page=100`;
  const list = run("gh", ["api", "--method", "GET", endpoint]);

  if (list.status !== 0) {
    fail(list.stderr.trim() || "Unable to list GitHub Actions CPG artifacts.");
  }

  let payload;
  try {
    payload = JSON.parse(list.stdout);
  } catch {
    fail("GitHub returned invalid artifact metadata.");
  }

  const artifact = selectArtifact(payload?.artifacts, identity.artifactName);
  if (!artifact) {
    fail(`No non-expired artifact matches ${identity.artifactName}. Build locally or wait for the CPG workflow for this source state.`);
  }

  const cacheRoot = path.join(repoRoot, ".context/cache");
  await mkdir(cacheRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(cacheRoot, "cpg-restore-"));

  try {
    const download = run("gh", [
      "run",
      "download",
      String(artifact.workflow_run.id),
      "--repo",
      repository,
      "--name",
      identity.artifactName,
      "--dir",
      tempDir
    ]);

    if (download.status !== 0) {
      fail(download.stderr.trim() || "Unable to download the CPG artifact.");
    }

    const downloadedCpg = await findFile(tempDir, "cpg.bin");
    const downloadedMetadata = await findFile(tempDir, "build.json");
    if (!downloadedCpg || !downloadedMetadata) {
      fail("Downloaded artifact does not contain both cpg.bin and build.json.");
    }

    let metadata;
    try {
      metadata = JSON.parse(await readFile(downloadedMetadata, "utf8"));
    } catch {
      fail("Downloaded build.json is not valid JSON.");
    }

    const downloadedCpgSha256 = await fingerprintFile(downloadedCpg);
    const metadataError = validateArtifactMetadata(metadata, identity, downloadedCpgSha256);
    if (metadataError) {
      fail(`Downloaded artifact failed metadata/integrity validation: ${metadataError}.`);
    }

    const outputDir = path.join(repoRoot, ".context/cpg");
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await copyFile(downloadedCpg, path.join(outputDir, "cpg.bin"));
    await copyFile(downloadedMetadata, path.join(outputDir, "build.json"));

    const validation = run(process.execPath, [
      path.join(repoRoot, "scripts/context/cpg-status.mjs"),
      "--check"
    ]);

    if (validation.status !== 0) {
      await rm(outputDir, { recursive: true, force: true });
      fail(validation.stderr.trim() || validation.stdout.trim() || "Restored CPG failed freshness validation.");
    }

    console.log(`Restored CURRENT CPG artifact ${identity.artifactName}.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptFile;
if (isMain) await main();

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fingerprintJsonFile } from "./cpg-source.mjs";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const manifestArg = process.argv[3];
const outputArg = process.argv[4];
const joernVersion = process.argv[5];
const commit = process.argv[6] ?? null;

if (!manifestArg || !outputArg || !joernVersion) {
  throw new Error("Usage: write-cpg-build-metadata.mjs <repo> <manifest> <output> <joern-version> [commit]");
}

const manifestPath = path.resolve(manifestArg);
const outputPath = path.resolve(outputArg);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const joernLockFingerprint = await fingerprintJsonFile(path.join(repoRoot, ".context/joern.lock.json"));

const metadata = {
  schemaVersion: 2,
  generator: "joern",
  version: joernVersion,
  commit,
  createdAt: new Date().toISOString(),
  fileCount: manifest.fileCount,
  sourceFingerprint: manifest.sourceFingerprint,
  configFingerprint: manifest.configFingerprint,
  joernLockFingerprint,
  fileHashes: manifest.fileHashes
};

await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

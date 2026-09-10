import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  fingerprintFile,
  fingerprintJsonFile,
  getCpgGeneratorState
} from "./cpg-source.mjs";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const manifestArg = process.argv[3];
const cpgArg = process.argv[4];
const outputArg = process.argv[5];
const joernVersion = process.argv[6];
const commit = process.argv[7] ?? null;

if (!manifestArg || !cpgArg || !outputArg || !joernVersion) {
  throw new Error(
    "Usage: write-cpg-build-metadata.mjs <repo> <manifest> <cpg> <output> <joern-version> [commit]"
  );
}

const manifestPath = path.resolve(manifestArg);
const cpgPath = path.resolve(cpgArg);
const outputPath = path.resolve(outputArg);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generator = await getCpgGeneratorState(repoRoot);
const joernLockFingerprint = await fingerprintJsonFile(path.join(repoRoot, ".context/joern.lock.json"));
const cpgSha256 = await fingerprintFile(cpgPath);

const metadata = {
  schemaVersion: 3,
  generator: "joern",
  version: joernVersion,
  commit: commit ?? null,
  generatedAt: new Date().toISOString(),
  fileCount: manifest.fileCount,
  sourceFingerprint: manifest.sourceFingerprint,
  configFingerprint: manifest.configFingerprint,
  generatorFingerprint: generator.generatorFingerprint,
  generatorFileHashes: generator.generatorFileHashes,
  joernLockFingerprint,
  cpgSha256,
  files: manifest.files,
  fileHashes: manifest.fileHashes
};

await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

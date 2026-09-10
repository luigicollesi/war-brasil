import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { getCpgSourceState } from "./cpg-source.mjs";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const outputRoot = path.resolve(process.argv[3] ?? path.join(repoRoot, ".context/cache/cpg-source"));
const state = await getCpgSourceState(repoRoot);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relativePath of state.files) {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  fileCount: state.fileCount,
  sourceFingerprint: state.sourceFingerprint,
  configFingerprint: state.configFingerprint,
  files: state.files,
  fileHashes: state.fileHashes
};

await writeFile(path.join(outputRoot, ".manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${state.fileCount} CPG source files in ${path.relative(repoRoot, outputRoot)}`);
console.log(`Source fingerprint: ${state.sourceFingerprint}`);

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const outputRoot = path.resolve(process.argv[3] ?? path.join(repoRoot, ".context/cache/cpg-source"));
const configPath = path.join(repoRoot, ".context/cpg.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

const normalize = (value) => value.split(path.sep).join("/").replace(/^\.\//, "");
const escapeRegex = (value) => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
const globToRegex = (glob) => {
  const normalized = normalize(glob);
  let regex = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*") {
      const next = normalized[index + 1];
      if (next === "*") {
        index += 1;
        if (normalized[index + 1] === "/") {
          index += 1;
          regex += "(?:.*/)?";
        } else {
          regex += ".*";
        }
      } else {
        regex += "[^/]*";
      }
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += escapeRegex(char);
    }
  }
  return new RegExp(`^${regex}$`);
};

const extensions = new Set(config.extensions ?? []);
const excludes = (config.exclude ?? []).map(globToRegex);
const supportFiles = config.supportFiles ?? [];
const copied = [];

const isExcluded = (relativePath) => excludes.some((pattern) => pattern.test(normalize(relativePath)));
const isSourceFile = (relativePath) => extensions.has(path.extname(relativePath));

async function copyFile(relativePath) {
  const normalized = normalize(relativePath);
  if (isExcluded(normalized)) return;
  const source = path.join(repoRoot, normalized);
  const destination = path.join(outputRoot, normalized);
  const fileStat = await stat(source).catch(() => null);
  if (!fileStat?.isFile()) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
  copied.push(normalized);
}

async function walk(relativeDir) {
  const normalizedDir = normalize(relativeDir);
  if (isExcluded(`${normalizedDir}/`)) return;
  const absoluteDir = path.join(repoRoot, normalizedDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = normalize(path.join(normalizedDir, entry.name));
    if (isExcluded(relativePath) || isExcluded(`${relativePath}/`)) continue;
    if (entry.isDirectory()) {
      await walk(relativePath);
    } else if (entry.isFile() && isSourceFile(relativePath)) {
      await copyFile(relativePath);
    }
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const root of config.roots ?? []) {
  await walk(root);
}
for (const supportFile of supportFiles) {
  await copyFile(supportFile);
}

copied.sort();
if (copied.length === 0) {
  throw new Error("CPG source staging produced no files. Check .context/cpg.config.json.");
}

const fingerprint = createHash("sha256").update(copied.join("\n")).digest("hex");
const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRoot: repoRoot,
  fileCount: copied.length,
  pathFingerprint: fingerprint,
  files: copied
};
await writeFile(path.join(outputRoot, ".manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${copied.length} CPG source files in ${path.relative(repoRoot, outputRoot)}`);

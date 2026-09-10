import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const normalize = (value) => value.split(path.sep).join("/").replace(/^\.\//, "");
const escapeRegex = (value) => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");

function globToRegex(glob) {
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
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function fingerprintJsonFile(filePath) {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  return sha256(canonicalJson(parsed));
}

export async function loadCpgConfig(repoRoot) {
  const configPath = path.join(repoRoot, ".context/cpg.config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return {
    config,
    configPath,
    configFingerprint: sha256(canonicalJson(config))
  };
}

export async function getCpgSourceState(repoRoot) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const { config, configPath, configFingerprint } = await loadCpgConfig(absoluteRepoRoot);
  const extensions = new Set(config.extensions ?? []);
  const excludes = (config.exclude ?? []).map(globToRegex);
  const selected = new Set();

  const isExcluded = (relativePath) => excludes.some((pattern) => pattern.test(normalize(relativePath)));
  const isSourceFile = (relativePath) => extensions.has(path.extname(relativePath));

  async function maybeAddFile(relativePath) {
    const normalized = normalize(relativePath);
    if (isExcluded(normalized)) return;
    const fileStat = await stat(path.join(absoluteRepoRoot, normalized)).catch(() => null);
    if (fileStat?.isFile()) selected.add(normalized);
  }

  async function walk(relativeDir) {
    const normalizedDir = normalize(relativeDir);
    if (isExcluded(`${normalizedDir}/`)) return;
    const absoluteDir = path.join(absoluteRepoRoot, normalizedDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = normalize(path.join(normalizedDir, entry.name));
      if (isExcluded(relativePath) || isExcluded(`${relativePath}/`)) continue;
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile() && isSourceFile(relativePath)) {
        selected.add(relativePath);
      }
    }
  }

  for (const root of config.roots ?? []) {
    await walk(root);
  }
  for (const supportFile of config.supportFiles ?? []) {
    await maybeAddFile(supportFile);
  }

  const files = [...selected].sort();
  if (files.length === 0) {
    throw new Error("CPG source selection produced no files. Check .context/cpg.config.json.");
  }

  const fileHashes = {};
  const aggregate = createHash("sha256");
  for (const relativePath of files) {
    const content = await readFile(path.join(absoluteRepoRoot, relativePath));
    const fileHash = sha256(content);
    fileHashes[relativePath] = fileHash;
    aggregate.update(relativePath);
    aggregate.update("\0");
    aggregate.update(fileHash);
    aggregate.update("\n");
  }

  return {
    config,
    configPath,
    configFingerprint,
    sourceFingerprint: aggregate.digest("hex"),
    fileCount: files.length,
    files,
    fileHashes
  };
}

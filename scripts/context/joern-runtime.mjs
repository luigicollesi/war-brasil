import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function isExecutable(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(root, name, maxDepth = 3, currentDepth = 0) {
  if (!root || currentDepth > maxDepth) return null;

  const direct = path.join(root, name);
  if (await isExecutable(direct)) return direct;

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findExecutable(path.join(root, entry.name), name, maxDepth, currentDepth + 1);
    if (found) return found;
  }

  return null;
}

export async function resolveJoernTool(repoRoot, toolName, explicitEnvVar) {
  const explicit = explicitEnvVar ? process.env[explicitEnvVar] : null;
  if (explicit) {
    const candidate = path.resolve(explicit);
    if (await isExecutable(candidate)) return candidate;
    throw new Error(`${explicitEnvVar} is not executable: ${candidate}`);
  }

  if (process.env.JOERN_HOME) {
    const candidate = await findExecutable(path.resolve(process.env.JOERN_HOME), toolName);
    if (candidate) return candidate;
    throw new Error(`${toolName} was not found under JOERN_HOME=${process.env.JOERN_HOME}`);
  }

  const lockPath = path.join(repoRoot, ".context/joern.lock.json");
  const configPath = path.join(repoRoot, ".context/cpg.config.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const cacheDirectory = config.generated?.cacheDirectory ?? ".context/cache";
  const cached = await findExecutable(path.join(repoRoot, cacheDirectory, "joern", lock.version), toolName);
  if (cached) return cached;

  throw new Error(`${toolName} from Joern ${lock.version} is not available. Set ${explicitEnvVar ?? "a tool override"}/JOERN_HOME or bootstrap Joern with CPG_BOOTSTRAP_JOERN=1 npm run context:cpg:build.`);
}

import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_OUTPUT_DIR = ".open-next";
const SCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const VULNERABLE_PATTERNS = [
  {
    label: "dynamic middleware manifest require",
    pattern: "require(this.middlewareManifestPath)",
  },
];

function extension(pathname) {
  const index = pathname.lastIndexOf(".");
  return index === -1 ? "" : pathname.slice(index);
}

async function collectScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectScriptFiles(absolute)));
      continue;
    }
    if (entry.isFile() && SCRIPT_EXTENSIONS.has(extension(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

async function assertFile(pathname, label) {
  const metadata = await stat(pathname);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`Cloudflare build inválido: ${label} ausente ou vazio.`);
  }
}

async function assertDirectory(pathname, label) {
  const metadata = await stat(pathname);
  if (!metadata.isDirectory()) {
    throw new Error(`Cloudflare build inválido: ${label} não é um diretório.`);
  }
}

export async function verifyCloudflareBuild(
  outputDir = resolve(process.cwd(), DEFAULT_OUTPUT_DIR),
) {
  const workerPath = resolve(outputDir, "worker.js");
  const assetsPath = resolve(outputDir, "assets");

  await assertFile(workerPath, ".open-next/worker.js");
  await assertDirectory(assetsPath, ".open-next/assets");

  const scripts = await collectScriptFiles(outputDir);
  const violations = [];

  for (const file of scripts) {
    const source = await readFile(file, "utf8");
    for (const vulnerable of VULNERABLE_PATTERNS) {
      if (source.includes(vulnerable.pattern)) {
        violations.push(
          `${relative(outputDir, file)}: ${vulnerable.label}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      [
        "Cloudflare build contém padrões incompatíveis com workerd:",
        ...violations.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  console.log(
    `Cloudflare build verificado: worker presente e ${scripts.length} módulos JS sem require dinâmico do middleware manifest.`,
  );
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  await verifyCloudflareBuild();
}

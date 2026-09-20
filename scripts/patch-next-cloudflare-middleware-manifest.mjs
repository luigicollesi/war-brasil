import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_NEXT_SERVER_PATH = "node_modules/next/dist/server/next-server.js";

export function patchNextServerSource(source) {
  const alreadyPatched =
    /\.loadManifest\)\(this\.middlewareManifestPath\)/.test(source) ||
    /\.loadManifest\(this\.middlewareManifestPath\)/.test(source);

  if (alreadyPatched) {
    return { changed: false, source };
  }

  const loadManifestImport = source.match(
    /const\s+([A-Za-z0-9_$]+)\s*=\s*require\(["']\.\/load-manifest\.external["']\)\s*;/,
  );

  if (!loadManifestImport) {
    throw new Error(
      "Cloudflare Next patch: import compilado de load-manifest.external não encontrado.",
    );
  }

  const binding = loadManifestImport[1];
  const target =
    /const\s+manifest\s*=\s*require\(this\.middlewareManifestPath\)\s*;/g;
  const matches = source.match(target) ?? [];

  if (matches.length !== 1) {
    throw new Error(
      `Cloudflare Next patch: esperado exatamente 1 require(this.middlewareManifestPath), encontrado ${matches.length}.`,
    );
  }

  const patched = source.replace(
    target,
    `const manifest = (0, ${binding}.loadManifest)(this.middlewareManifestPath);`,
  );

  return { changed: true, source: patched };
}

export async function patchInstalledNextServer(
  filePath = resolve(process.cwd(), DEFAULT_NEXT_SERVER_PATH),
) {
  const source = await readFile(filePath, "utf8");
  const result = patchNextServerSource(source);

  if (result.changed) {
    await writeFile(filePath, result.source, "utf8");
    console.log(
      "Cloudflare Next patch aplicado: middleware manifest passa por loadManifest().",
    );
  } else {
    console.log("Cloudflare Next patch já estava aplicado.");
  }

  return result.changed;
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  await patchInstalledNextServer();
}

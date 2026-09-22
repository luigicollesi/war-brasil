import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const COVERAGE_ROOTS = [
  ".test-build/shared",
  ".test-build/bots",
  ".test-build/events",
  ".test-build/client/map",
  ".test-build/client/dice",
  ".test-build/client/sync",
  ".test-build/client/operations",
];

const SOURCE_ALIAS_PREFIX = "@/src/lib/";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(SOURCE_ALIAS_PREFIX)) {
      const relativePath = specifier.slice(SOURCE_ALIAS_PREFIX.length);
      return {
        url: pathToFileURL(
          resolve(".test-build", `${relativePath}.js`),
        ).href,
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(path)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path);
    }
  }

  return files;
}

test("white-box coverage scope loads every deterministic core module", async () => {
  const files = (
    await Promise.all(COVERAGE_ROOTS.map(collectJavaScriptFiles))
  )
    .flat()
    .sort();

  assert.ok(files.length > 0, "coverage scope must contain compiled modules");

  for (const file of files) {
    await import(pathToFileURL(resolve(file)).href);
  }
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const RUNTIME_ROOT = path.resolve("src");
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".scss"]);
const EXCLUDED_PREFIXES = [
  path.resolve("src/lib/db/migrations"),
];
const LEGACY_DICE_PATTERNS = [
  { label: "diretório local /dados/", pattern: /["'`]\/dados\// },
  {
    label: "SVG nativo de dado",
    pattern: /["'`]\/dado-(?:brasil-hq|ataque-vermelho-hq|defesa-azul-hq)\.svg/,
  },
  {
    label: "SVG temático de ataque/defesa/neutro",
    pattern: /["'`][^"'`]*(?:ataque|defesa|neutro)\.svg/,
  },
];

function runtimeFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (EXCLUDED_PREFIXES.some((prefix) => absolute.startsWith(prefix))) continue;
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      files.push(...runtimeFiles(absolute));
      continue;
    }
    if (TEXT_EXTENSIONS.has(path.extname(entry))) files.push(absolute);
  }
  return files;
}

test("runtime não volta a depender dos SVGs locais de dados", () => {
  const violations = [];

  for (const file of runtimeFiles(RUNTIME_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const { label, pattern } of LEGACY_DICE_PATTERNS) {
      if (!pattern.test(source)) continue;
      violations.push(`${path.relative(process.cwd(), file)}: ${label}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Referências legadas de dados encontradas no runtime:\n${violations.join("\n")}`,
  );
});

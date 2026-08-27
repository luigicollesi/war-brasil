import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PURE_MODULES = [
  "src/lib/game-rules.ts",
  "src/lib/territory-connections.ts",
  "src/lib/game-interaction.ts",
  "src/lib/game-snapshot-hydration.ts",
  "src/lib/game-command-patch.ts",
  "src/lib/game-snapshot-sharing.ts",
  "src/lib/game-view-model.ts",
];

test("módulos puros de domínio não dependem de browser, React, banco ou server-only", () => {
  for (const path of PURE_MODULES) {
    const source = readFileSync(path, "utf8");

    assert.doesNotMatch(source, /from ["']react["']/i, path);
    assert.doesNotMatch(source, /server-only/, path);
    assert.doesNotMatch(source, /\bwindow\b/, path);
    assert.doesNotMatch(source, /\bdocument\b/, path);
    assert.doesNotMatch(source, /\bPoolClient\b|from ["']pg["']/i, path);
  }
});

test("módulos puros compilados pela suíte usam imports locais em vez de alias do bundler", () => {
  for (const path of PURE_MODULES) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from ["']@\//, path);
  }
});

test("configuração dedicada mantém a compilação dos testes fora do tsconfig de produção", () => {
  const config = readFileSync("tsconfig.test.json", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  assert.match(config, /"outDir"\s*:\s*"\.test-build"/);
  assert.match(config, /"module"\s*:\s*"commonjs"/);
  assert.equal(packageJson.scripts["test:compile"], "tsc -p tsconfig.test.json");
  assert.equal(packageJson.scripts.test, "npm run test:compile && npm run test:run");
});

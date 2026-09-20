import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const ECONOMY_REPOSITORY = "src/lib/server/economy/economy-repository.ts";

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function sourceFiles(root) {
  const result = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (path.includes("src/lib/db/migrations")) continue;
      result.push(...sourceFiles(path));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(extension(path))) result.push(path);
  }
  return result;
}

const runtimeFiles = ["src/app", "src/components", "src/hooks", "src/lib"]
  .flatMap(sourceFiles)
  .sort();

test("economia v2 restringe débito de wallet e escrita de ledger ao repository autoritativo", () => {
  const repository = readFileSync(ECONOMY_REPOSITORY, "utf8");
  assert.match(repository, /UPDATE\s+economy\.wallets\b/i);
  assert.match(repository, /INSERT\s+INTO\s+economy\.ledger_entries\b/i);
  assert.doesNotMatch(repository, /DELETE\s+FROM\s+economy\.wallets\b/i);
  assert.doesNotMatch(repository, /UPDATE\s+economy\.ledger_entries\b/i);
  assert.doesNotMatch(repository, /DELETE\s+FROM\s+economy\.ledger_entries\b/i);

  const forbiddenOutsideRepository = [
    /UPDATE\s+economy\.wallets\b/i,
    /DELETE\s+FROM\s+economy\.wallets\b/i,
    /INSERT\s+INTO\s+economy\.ledger_entries\b/i,
    /UPDATE\s+economy\.ledger_entries\b/i,
    /DELETE\s+FROM\s+economy\.ledger_entries\b/i,
  ];

  for (const path of runtimeFiles) {
    if (path === ECONOMY_REPOSITORY) continue;
    const content = readFileSync(path, "utf8");
    for (const pattern of forbiddenOutsideRepository) {
      assert.doesNotMatch(
        content,
        pattern,
        `${path} não pode ser autoridade monetária da Economy V2`,
      );
    }
  }
});

test("único INSERT runtime de wallet pertence à inicialização idempotente", () => {
  const inserts = [];
  for (const path of runtimeFiles) {
    const content = readFileSync(path, "utf8");
    if (/INSERT\s+INTO\s+economy\.wallets\b/i.test(content)) {
      inserts.push({ path, content });
    }
  }

  assert.deepEqual(
    inserts.map((item) => item.path),
    [ECONOMY_REPOSITORY],
  );
  assert.match(inserts[0].content, /balance\)[\s\S]*VALUES\(\$1::uuid, 'campaign-credit', 0\)/);
  assert.match(inserts[0].content, /ON CONFLICT \(user_id, currency_code\) DO NOTHING/);
});

test("gameplay não depende do domínio economy para vitória, combate ou turnos", () => {
  for (const path of runtimeFiles.filter((item) => item.includes("src/lib/server/game"))) {
    const content = readFileSync(path, "utf8");
    assert.doesNotMatch(content, /economy\.wallets|economy\.ledger_entries/);
    assert.doesNotMatch(content, /campaign-credit|Créditos de Campanha/);
  }
});

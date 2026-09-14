import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

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

test("economia v1 não possui mutação runtime de saldo ou ledger", () => {
  const forbidden = [
    /UPDATE\s+economy\.wallets\b/i,
    /DELETE\s+FROM\s+economy\.wallets\b/i,
    /INSERT\s+INTO\s+economy\.ledger_entries\b/i,
    /UPDATE\s+economy\.ledger_entries\b/i,
    /DELETE\s+FROM\s+economy\.ledger_entries\b/i,
  ];

  for (const path of runtimeFiles) {
    const content = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `${path} não pode alterar dinheiro nesta entrega`,
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
    ["src/lib/server/economy/economy-repository.ts"],
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

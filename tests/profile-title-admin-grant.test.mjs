import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/grant-all-commander-titles.mjs",
  "utf8",
);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("admin title grant resolves accountId server-side and grants all active titles idempotently", () => {
  assert.match(source, /auth\."account"/);
  assert.match(source, /"accountId"=\$1/);
  assert.match(source, /catalog\.commander_titles/);
  assert.match(source, /profile\.commander_titles/);
  assert.match(source, /'admin'/);
  assert.match(source, /ON CONFLICT \(user_id, title_id\) DO NOTHING/);
  assert.match(source, /commander_title_stats/);
  assert.match(source, /owned_active/);
  assert.match(source, /active_total/);
  assert.doesNotMatch(source, /100701457262893939659/);
  assert.equal(
    pkg.scripts["titles:grant-all"],
    "node scripts/grant-all-commander-titles.mjs",
  );
});

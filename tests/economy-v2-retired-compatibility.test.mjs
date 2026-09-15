import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/lib/server/economy/economy-service.ts",
  "utf8",
);

test("cosmético retired já possuído continua elegível para equipagem", () => {
  assert.match(
    service,
    /item\.status !== "available" && item\.status !== "retired"/,
  );
});

test("compra continua exigindo itens available e não adquire retired", () => {
  assert.match(
    service,
    /offerItems\.some\(\(item\) => item\.status !== "available" \|\| item\.is_default\)/,
  );
});

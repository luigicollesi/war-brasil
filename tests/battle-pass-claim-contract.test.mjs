import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("claim de Passe registra claim antes da concessão e mantém tudo na mesma transação", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );

  const claimIndex = service.indexOf("const created = await insertClaim");
  const creditIndex = service.indexOf("await grantCreditReward");
  const itemIndex = service.indexOf("await grantEntitlementReward");

  assert.ok(claimIndex >= 0);
  assert.ok(creditIndex > claimIndex);
  assert.ok(itemIndex > claimIndex);
  assert.match(service, /await client\.query\("BEGIN"\)/);
  assert.match(service, /await client\.query\("COMMIT"\)/);
  assert.match(service, /await client\.query\("ROLLBACK"\)/);
});

test("recompensa monetária usa wallet e ledger idempotente do Economy V2", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );

  assert.match(service, /balance=balance\+\$2::bigint/);
  assert.match(service, /'battle_pass_reward'/);
  assert.match(service, /battle-pass:\$\{reward\.season_id\}/);
  assert.match(service, /ensureEconomyState\(userId, client\)/);
});

test("recompensas reutilizam ownership canônico com acquisition_source reward", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );

  assert.match(service, /INSERT INTO inventory\.cosmetics/);
  assert.match(service, /INSERT INTO profile\.commander_titles/);
  assert.match(service, /INSERT INTO profile\.commander_backgrounds/);
  assert.ok((service.match(/'reward'/g) ?? []).length >= 3);
});

test("claim-all deriva rewards elegíveis no servidor e não recebe valores do cliente", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );

  assert.match(service, /reward\.level <= \$3/);
  assert.match(service, /reward\.track='free' OR \$4::boolean/);
  assert.match(service, /claimed\.reward_id IS NULL/);
  assert.doesNotMatch(
    service,
    /payload.*credit_amount|payload.*cosmetic_id|payload.*title_id|payload.*background_id/s,
  );
});

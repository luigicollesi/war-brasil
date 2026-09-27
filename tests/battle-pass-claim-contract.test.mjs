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

test("recompensa monetária delega wallet e ledger ao repository autoritativo da Economy V2", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );
  const repository = read(
    "src/lib/server/economy/economy-repository.ts",
  );

  assert.match(service, /creditCampaignCreditReward/);
  assert.match(service, /battle-pass:\$\{reward\.season_id\}/);
  assert.match(service, /ensureEconomyState\(userId, client\)/);
  assert.doesNotMatch(service, /UPDATE\s+economy\.wallets/i);
  assert.doesNotMatch(service, /INSERT\s+INTO\s+economy\.ledger_entries/i);

  assert.match(repository, /export async function creditCampaignCreditReward/);
  assert.match(repository, /balance=balance\+\$2::bigint/);
  assert.match(repository, /'battle_pass_reward'/);
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
  const claimRoute = read(
    "src/app/api/battle-pass/rewards/claim/route.ts",
  );
  const claimAllRoute = read(
    "src/app/api/battle-pass/rewards/claim-all/route.ts",
  );
  assert.doesNotMatch(
    `${claimRoute}\n${claimAllRoute}`,
    /creditAmount|cosmeticId|titleId|backgroundId|credit_amount|cosmetic_id|title_id|background_id/,
  );
});


test("claim-all retorna resumo determinístico por categoria e histórico já coletado", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );

  assert.match(service, /alreadyClaimedCount/);
  assert.match(service, /gameCosmeticCount/);
  assert.match(service, /titleCount/);
  assert.match(service, /backgroundCount/);
  assert.match(service, /JOIN progression\.battle_pass_reward_claims claimed/);
  assert.match(page, /claimReveal\.gameCosmeticCount/);
  assert.match(page, /claimReveal\.backgroundCount/);
  assert.match(page, /claimReveal\.titleCount/);
  assert.match(page, /já estavam coletadas/);
});

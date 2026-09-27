import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("observabilidade do Passe usa payload estruturado e campos explícitos", () => {
  const events = read(
    "src/lib/server/observability/battle-pass-events.ts",
  );

  for (const event of [
    "battle_pass_xp_granted",
    "battle_pass_xp_duplicate_ignored",
    "battle_pass_premium_unlocked",
    "battle_pass_reward_claimed",
    "battle_pass_claim_duplicate",
    "battle_pass_claim_failed",
  ]) {
    assert.match(events, new RegExp(event));
  }

  assert.match(events, /seasonId\?: string \| null/);
  assert.match(events, /matchId\?: string \| null/);
  assert.match(events, /userId\?: string \| null/);
  assert.match(events, /xpEntryId\?: string \| null/);
  assert.match(events, /rewardId\?: string \| null/);
  assert.match(events, /purchaseId\?: string \| null/);
  assert.doesNotMatch(
    events,
    /sessionToken|authorization|cookie|payment|cardNumber|secret/i,
  );
});

test("claims só emitem outcome depois que o serviço transacional retorna", () => {
  const claim = read(
    "src/app/api/battle-pass/rewards/claim/route.ts",
  );
  const claimAll = read(
    "src/app/api/battle-pass/rewards/claim-all/route.ts",
  );
  const claimGroup = read(
    "src/app/api/battle-pass/rewards/claim-group/route.ts",
  );

  assert.match(
    claim,
    /await claimBattlePassReward[\s\S]*logBattlePassClaimOutcomes/,
  );
  assert.match(
    claimAll,
    /await claimAllBattlePassRewards[\s\S]*logBattlePassClaimOutcomes/,
  );
  assert.match(
    claimGroup,
    /await claimBattlePassRewardGroup[\s\S]*logBattlePassClaimOutcomes/,
  );

  for (const route of [claim, claimAll, claimGroup]) {
    assert.match(route, /battle_pass_claim_failed/);
    assert.match(route, /battlePassErrorCode/);
  }
});

test("unlock Elite é observado somente no caminho de compra nova após COMMIT", () => {
  const service = read(
    "src/lib/server/economy/economy-service.ts",
  );
  const purchaseStart = service.indexOf("export async function purchaseOffer");
  const replayStart = service.indexOf("if (existing)", purchaseStart);
  const newPurchaseId = service.indexOf("const purchaseId = randomUUID()", replayStart);
  const eventIndex = service.indexOf(
    'logBattlePassEvent("battle_pass_premium_unlocked"',
    newPurchaseId,
  );
  const commitBeforeEvent = service.lastIndexOf(
    'await client.query("COMMIT")',
    eventIndex,
  );

  assert.ok(newPurchaseId > replayStart);
  assert.ok(eventIndex > newPurchaseId);
  assert.ok(commitBeforeEvent > newPurchaseId);
  assert.ok(eventIndex > commitBeforeEvent);
  assert.doesNotMatch(
    service.slice(replayStart, newPurchaseId),
    /battle_pass_premium_unlocked/,
  );
});

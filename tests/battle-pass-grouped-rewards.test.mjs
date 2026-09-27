import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("snapshot projeta presentation_group_key até o contrato da Campanha", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-snapshot-service.ts",
  );
  const presentation = read(
    "src/lib/shared/progression/battle-pass-presentation.ts",
  );

  assert.match(service, /reward\.presentation_group_key/);
  assert.match(service, /presentationGroupKey: row\.presentation_group_key/);
  assert.match(presentation, /presentationGroupKey: string \| null/);
});

test("claim de conjunto deriva composição no servidor a partir de um único rewardId", () => {
  const service = read(
    "src/lib/server/progression/battle-pass-reward-service.ts",
  );
  const route = read(
    "src/app/api/battle-pass/rewards/claim-group/route.ts",
  );

  assert.match(service, /claimBattlePassRewardGroup/);
  assert.match(service, /anchor\.presentation_group_key/);
  assert.match(service, /presentation_group_key=\$4/);
  assert.match(service, /ORDER BY position,id/);
  assert.match(service, /await claimRewardInTransaction\(client, userId, member\.id\)/);
  assert.match(route, /parseBattlePassClaimInput\(payload\)/);
  assert.match(route, /claimBattlePassRewardGroup/);
  assert.doesNotMatch(
    route,
    /input\.groupKey|payload\.groupKey|input\.rewardIds|payload\.rewardIds|input\.cosmeticIds|payload\.cosmeticIds/,
  );
  assert.match(route, /result\.groupKey/);
});

test("conjunto Elite inicial aparece como um único card e reveal composto", () => {
  const page = read(
    "src/components/progression/battle-pass/battle-pass-page.tsx",
  );
  const css = read(
    "src/components/progression/battle-pass/battle-pass-page.module.css",
  );

  assert.match(page, /groupedRewards\(level\.premiumRewards\)/);
  assert.match(page, /<RewardGroupCard/);
  assert.match(page, /\/api\/battle-pass\/rewards\/claim-group/);
  assert.match(page, /Conjunto Inicial de Elite/);
  assert.match(page, /kind: "group"/);
  assert.match(css, /\.rewardGroup/);
  assert.match(css, /\.rewardGroupVisuals/);
  assert.match(css, /\.rewardRevealGroup/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const contract = read("src/lib/profile/beta-tester-welcome-reward.ts");
const service = read(
  "src/lib/server/profile/beta-tester-welcome-reward-service.ts",
);
const economyRepository = read(
  "src/lib/server/economy/economy-repository.ts",
);
const route = read(
  "src/app/api/profile/beta-tester-reward/claim/route.ts",
);
const modal = read(
  "src/components/pre-game/home/beta-tester-welcome-reward-modal.tsx",
);
const homePage = read("src/app/home/page.tsx");
const homeClient = read(
  "src/components/pre-game/home/command-home-client.tsx",
);

test("recompensa Beta Tester temporária mantém pacote hardcoded canônico", () => {
  assert.match(contract, /titleId: "title\.beta-tester"/);
  assert.match(contract, /credits: 3000/);
  assert.match(contract, /"dice\.attack\.brazil"/);
  assert.match(contract, /"dice\.defense\.brazil"/);
  assert.match(contract, /"dice\.neutral\.brazil"/);
  assert.match(contract, /cosmetics\/dice\/brazil\/attack\.webp/);
  assert.match(contract, /cosmetics\/dice\/brazil\/defense\.webp/);
  assert.match(contract, /cosmetics\/dice\/brazil\/neutral\.webp/);
});

test("claim Beta Tester é server-side, promocional, transacional e idempotente", () => {
  assert.match(service, /await client\.query\("BEGIN"\)/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /ensureEconomyState\(userId, client\)/);
  assert.match(service, /owned\.title_id=\$2/);
  assert.match(service, /creditCampaignCreditPromotion/);
  assert.doesNotMatch(service, /UPDATE\\s+economy\\.wallets|INSERT\\s+INTO\\s+economy\\.ledger_entries/i);
  assert.match(economyRepository, /export async function creditCampaignCreditPromotion/);
  assert.match(economyRepository, /'promotion'/);
  assert.match(economyRepository, /ON CONFLICT DO NOTHING/);
  assert.match(economyRepository, /balance=balance\\+\\$2::bigint/);
  assert.match(service, /catalog\.cosmetic_stats/);
  assert.match(service, /acquisition_count=acquisition_count\+1/);
  assert.doesNotMatch(service, /profile\.cosmetic_loadout/);
});

test("rota de claim não aceita autoridade econômica enviada pelo navegador", () => {
  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(route, /rejectUntrustedMutationOrigin\(request\)/);
  assert.match(route, /claimBetaTesterWelcomeReward\(session\.user\.id\)/);
  assert.doesNotMatch(route, /request\.json|readBoundedJsonBody|credits|cosmeticId/);
});

test("primeiro /home recebe estado server-side e exibe modal até o claim", () => {
  assert.match(homePage, /getBetaTesterWelcomeRewardState\(session\.user\.id\)/);
  assert.match(homePage, /initialBetaTesterReward=\{betaTesterReward\}/);
  assert.match(homeClient, /initialBetaTesterReward\?\.pending === true/);
  assert.match(homeClient, /<BetaTesterWelcomeRewardModal/);
  assert.match(homeClient, /setBetaTesterRewardClaimedLocally\(true\)/);
  assert.match(homeClient, /router\.refresh\(\)/);
  assert.match(modal, /\/api\/profile\/beta-tester-reward\/claim/);
  assert.match(modal, /RECEBER RECOMPENSA/);
  assert.match(modal, /não altera seus cosméticos equipados/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("troca de cartas só é aceita durante reinforcement", () => {
  const troopService = source("src/lib/server/game-troop-command-service.ts");
  const runner = source("src/lib/bots/bot-runner.ts");
  const strategy = source("src/lib/bots/bot-strategy.ts");
  const cards = source("src/lib/bots/bot-cards.ts");

  assert.match(troopService, /room\.phase !== "reinforcement"/);
  assert.doesNotMatch(
    troopService,
    /\["cards",\s*"reinforcement"\]\.includes\(room\.phase\)/,
  );
  assert.match(runner, /if \(room\.phase === "cards"\) return \{ type: "finish_cards" \}/);
  assert.match(strategy, /state\.room\.phase === "reinforcement"/);
  assert.match(strategy, /chooseCardTrade/);
  assert.match(cards, /state\.cards\.length >= 5/);
  assert.match(cards, /mandatory/);
});

test("eliminação avalia primeiro o conquistador e depois donos da missão", () => {
  const battle = source("src/lib/server/game-battle-service.ts");

  const conquerorCheck = battle.indexOf("const conquerorWon = await objectiveWon(");
  const indirectCheck = battle.indexOf("await evaluateEliminationObjectiveOwners(");

  assert.ok(conquerorCheck >= 0);
  assert.ok(indirectCheck > conquerorCheck);
  assert.match(battle, /AND p\.turn_position IS NOT NULL/);
  assert.match(battle, /a\.player_id<>\$3/);
});

test("eliminação continua removendo o jogador da ordem e transferindo a mão", () => {
  const battle = source("src/lib/server/game-battle-service.ts");

  assert.match(battle, /SET turn_position=NULL,bot_next_action_at=NULL/);
  assert.match(
    battle,
    /SET owner_player_id=\$3[\s\S]*owner_player_id=\$2 AND zone='hand'/,
  );
});

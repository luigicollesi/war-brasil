import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("estado estratégico lê somente objetivo e cartas privadas do próprio bot", () => {
  const stateService = source("src/lib/bots/bot-state-service.ts");
  assert.match(stateService, /WHERE a\.room_id=\$1 AND a\.player_id=\$2/);
  assert.match(stateService, /owner_player_id=\$2 AND zone='hand'/);
  assert.doesNotMatch(stateService, /SELECT[\s\S]*game_player_objectives[\s\S]*WHERE a\.room_id=\$1\s*(?:ORDER|$)/);
  assert.doesNotMatch(stateService, /SELECT[\s\S]*game_cards[\s\S]*WHERE room_id=\$1\s*(?:ORDER|$)/);
});

test("estratégia permanece pura e não abre transação nem chama HTTP", () => {
  const files = [
    "src/lib/bots/bot-objective-plan.ts",
    "src/lib/bots/bot-combat-odds.ts",
    "src/lib/bots/bot-routing.ts",
    "src/lib/bots/bot-territory-value.ts",
    "src/lib/bots/bot-defense.ts",
    "src/lib/bots/bot-cards.ts",
    "src/lib/bots/bot-reinforcement.ts",
    "src/lib/bots/bot-attack.ts",
    "src/lib/bots/bot-conquest.ts",
    "src/lib/bots/bot-maneuver.ts",
    "src/lib/bots/bot-strategy.ts",
  ];

  for (const path of files) {
    const content = source(path);
    assert.doesNotMatch(content, /gameCommand|gameConditionalCommand|client\.query|fetch\(|cookies\(|player_session/);
  }
});

test("runner decide somente após o delay vencer e usa executores compartilhados", () => {
  const runner = source("src/lib/bots/bot-runner.ts");
  const delayCheck = runner.indexOf("actor.bot_next_action_at.getTime() > nowMs");
  const loadState = runner.indexOf("loadBotStrategicState");
  const dueChoice = runner.lastIndexOf("chooseDueAction(client, room, actor)");

  assert.ok(delayCheck >= 0);
  assert.ok(dueChoice > delayCheck);
  assert.match(runner, /executeAttack\(client, roomId, player, action\)/);
  assert.match(runner, /executeManeuver\(client, roomId, player, action\)/);
  assert.doesNotMatch(runner, /attackCommand|maneuverCommand|reinforceCommand|tradeCardsCommand/);
  assert.match(runner, /loadBotStrategicState/);
  assert.ok(loadState >= 0);
});

test("estratégia não persiste alvo rota ou personalidade", () => {
  const schema = source("src/lib/db/schema.sql");
  assert.doesNotMatch(schema, /planned_target|planned_route|bot_strategy|bot_aggression|bot_personality/);
});

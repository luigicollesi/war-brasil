import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isPresentationAdvancePending,
  requiredActorId,
} from "../.test-build/bots/bot-required-actor.js";
import { botDelayRange } from "../.test-build/bots/bot-delay.js";
import {
  eligibleOrderPlayerIds,
  nextOrderRollPlayerId,
} from "../.test-build/game-order-rules.js";

function battle(stage, attackerPlayerId = "human", defenderPlayerId = "bot") {
  return {
    attacker: [],
    defender: [],
    attackerLosses: 0,
    defenderLosses: 0,
    conquered: false,
    attackerTerritoryId: 1,
    defenderTerritoryId: 2,
    attackerPlayerId,
    defenderPlayerId,
    stage,
    stageStartedAt: "2026-08-31T12:00:00.000Z",
  };
}

test("sorteio compartilhado resolve próximo jogador e desempates", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextOrderRollPlayerId(players, [], 1), "a");

  const roundOne = [
    { player_id: "a", roll_round: 1, value: 6 },
    { player_id: "b", roll_round: 1, value: 6 },
    { player_id: "c", roll_round: 1, value: 2 },
  ];
  assert.deepEqual(eligibleOrderPlayerIds(players, roundOne, 2), ["a", "b"]);
  assert.equal(nextOrderRollPlayerId(players, roundOne, 2), "a");

  const withTieRoll = [
    ...roundOne,
    { player_id: "a", roll_round: 2, value: 4 },
  ];
  assert.equal(nextOrderRollPlayerId(players, withTieRoll, 2), "b");
});

test("defensor bot é ator obrigatório mesmo durante turno humano", () => {
  assert.equal(
    requiredActorId({
      status: "playing",
      orderRollPlayerId: null,
      currentPlayerId: "human",
      battle: battle("awaiting_defender_roll"),
      pendingConquest: false,
    }),
    "bot",
  );
});

test("estágios de apresentação bloqueiam ator e continuam avanço automático", () => {
  const currentBattle = battle("show_attacker_result");
  assert.equal(
    requiredActorId({
      status: "playing",
      orderRollPlayerId: null,
      currentPlayerId: "human",
      battle: currentBattle,
      pendingConquest: false,
    }),
    null,
  );
  assert.equal(
    isPresentationAdvancePending({
      status: "playing",
      orderRollPlayerId: null,
      eligiblePlayerCount: 0,
      battle: currentBattle,
    }),
    true,
  );
});

test("conquista e fases normais devolvem o jogador atual", () => {
  for (const pendingConquest of [false, true]) {
    assert.equal(
      requiredActorId({
        status: "playing",
        orderRollPlayerId: null,
        currentPlayerId: "bot",
        battle: null,
        pendingConquest,
      }),
      "bot",
    );
  }
});

test("sorteio sem próximo ator fica reservado para apresentação", () => {
  assert.equal(
    isPresentationAdvancePending({
      status: "order_roll",
      orderRollPlayerId: null,
      eligiblePlayerCount: 2,
      battle: null,
    }),
    true,
  );
});

test("delays de bot são curtos, positivos e centralizados para todas as ações", () => {
  for (const action of [
    "roll_order",
    "finish_cards",
    "trade_cards",
    "reinforce",
    "attack",
    "finish_attack",
    "roll_battle",
    "complete_conquest",
    "maneuver",
    "end_turn",
  ]) {
    const range = botDelayRange(action);
    assert.ok(range.minMs > 0);
    assert.ok(range.maxMs >= range.minMs);
    assert.ok(range.maxMs <= 2_000);
  }
});

test("runner é request-driven, executa regra compartilhada e não cria loop servidor", () => {
  const runner = readFileSync("src/lib/bots/bot-runner.ts", "utf8");

  assert.match(runner, /bot_next_action_at/);
  assert.match(runner, /executeBotAction/);
  assert.match(runner, /executeReinforcement/);
  assert.match(runner, /executeRollBattleDice/);
  assert.match(runner, /executeAttack/);
  assert.match(runner, /executeManeuver/);
  assert.doesNotMatch(runner, /\bwhile\s*\(|setTimeout|setInterval|\bsleep\s*\(/);
  assert.doesNotMatch(
    runner,
    /reinforceCommand|attackCommand|maneuverCommand|rollBattleDiceCommand|phaseCommand/,
  );
});

test("runner isola ação estratégica rejeitada e usa somente um fallback seguro", () => {
  const runner = readFileSync("src/lib/bots/bot-runner.ts", "utf8");

  assert.match(runner, /SAVEPOINT \$\{STRATEGIC_SAVEPOINT\}/);
  assert.match(runner, /ROLLBACK TO SAVEPOINT \$\{STRATEGIC_SAVEPOINT\}/);
  assert.match(runner, /error instanceof RoomError/);
  assert.match(runner, /\[409, 422\]\.includes\(error\.status\)/);
  assert.match(runner, /rejected\.type === "attack"[\s\S]*finish_attack/);
  assert.match(runner, /rejected\.type === "maneuver"[\s\S]*end_turn/);
  assert.match(runner, /rejected\.type === "complete_conquest"[\s\S]*troops: 1/);
  assert.match(runner, /rejected\.type === "reinforce"[\s\S]*firstOwned/);
  assert.doesNotMatch(runner, /catch\s*\([^)]*\)\s*\{\s*return\s*;/);
});

test("automação serializa apresentação e bot em um único command condicional", () => {
  const automation = readFileSync("src/lib/server/game-automation-service.ts", "utf8");
  const route = readFileSync(
    "src/app/api/games/[roomId]/advance/route.ts",
    "utf8",
  );

  assert.match(automation, /gameConditionalCommand/);
  assert.match(
    automation,
    /presentationChanged = await advanceGamePresentation[\s\S]*if \(presentationChanged\)[\s\S]*advanceBotAutomation/,
  );
  assert.match(route, /advanceGameAutomationCommand/);
  assert.match(route, /expectedRevision/);
});

test("schema da fase 2 persiste apenas o horário da próxima ação", () => {
  const schema = readFileSync("src/lib/db/schema.sql", "utf8");
  const migration = readFileSync(
    "src/lib/db/migrations/012-bot-automation.sql",
    "utf8",
  );

  assert.match(schema, /bot_next_action_at TIMESTAMPTZ/);
  assert.match(migration, /bot_next_action_at TIMESTAMPTZ/);
  assert.doesNotMatch(schema, /bot_strategy|planned_target|planned_route/);
});

test("snapshot aciona o mesmo polling para apresentação e ator bot", () => {
  const snapshot = readFileSync("src/lib/server/game-snapshot-service.ts", "utf8");
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(snapshot, /automaticAdvancePending/);
  assert.match(snapshot, /requiredActorId/);
  assert.match(sync, /snapshot\.room\.automaticAdvancePending/);
  assert.match(sync, /\/advance/);
  assert.doesNotMatch(sync, /bot.*setInterval|setInterval.*bot/i);
});

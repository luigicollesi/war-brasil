import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("eliminação concede 100 XP autoritativos e possui ledger próprio", () => {
  const migration = read(
    "src/lib/db/migrations/managed/085-battle-pass-player-elimination-xp.sql",
  );
  const contract = read(
    "src/lib/shared/progression/battle-pass-contract.ts",
  );
  const parser = read(
    "src/lib/shared/progression/battle-pass-xp.ts",
  );
  const snapshot = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );
  const action = read(
    "src/lib/server/progression/battle-pass-match-action-xp-service.ts",
  );

  assert.match(
    migration,
    /player_elimination_xp INTEGER NOT NULL DEFAULT 100/,
  );
  assert.match(
    migration,
    /'player_elimination'/,
  );
  assert.match(
    migration,
    /profile\.player_elimination_xp=100/,
  );
  assert.match(contract, /playerEliminationXp: number/);
  assert.match(
    parser,
    /playerEliminationXp:[\s\S]*row\.playerEliminationXp === undefined[\s\S]*0/,
  );
  assert.match(snapshot, /profile\.player_elimination_xp/);
  assert.match(snapshot, /playerEliminationXp:/);
  assert.match(action, /recordBattlePassPlayerElimination/);
  assert.match(action, /actionKind: "player_elimination"/);
  assert.match(action, /profile\.playerEliminationXp/);
});

test("eliminação é concedida somente ao atacante que remove o último território", () => {
  const battle = read("src/lib/server/game-battle-service.ts");

  const noTerritories = battle.indexOf("if (!defenderStillHasTerritory.rowCount)");
  const eliminate = battle.indexOf("await eliminatePlayer(", noTerritories);
  const eliminationXp = battle.indexOf(
    "await recordBattlePassPlayerElimination(",
    eliminate,
  );
  const thirdPartyObjectives = battle.indexOf(
    "await evaluateEliminationObjectiveOwners(",
    eliminationXp,
  );

  assert.ok(noTerritories >= 0);
  assert.ok(eliminate > noTerritories);
  assert.ok(eliminationXp > eliminate);
  assert.ok(thirdPartyObjectives > eliminationXp);
  assert.match(
    battle.slice(eliminationXp, thirdPartyObjectives),
    /playerId: battle\.attackerPlayerId/,
  );
  assert.match(
    battle.slice(eliminationXp, thirdPartyObjectives),
    /eliminatedPlayerId: battle\.defenderPlayerId/,
  );
});

test("uma resolução de batalha agrega combate, conquista e eliminação em um feedback", () => {
  const action = read(
    "src/lib/server/progression/battle-pass-match-action-xp-service.ts",
  );
  const automation = read("src/lib/server/game-automation-service.ts");

  assert.match(action, /composeBattlePassActionXpEvents/);
  assert.match(action, /player_eliminated/);
  assert.match(action, /JOGADOR ELIMINADO/);
  assert.match(action, /TERRITÓRIO DOMINADO/);
  assert.match(action, /RECONQUISTA/);
  assert.match(action, /CONFRONTO/);
  assert.match(action, /events\.reduce\([\s\S]*event\.xp/);

  assert.match(
    automation,
    /composeBattlePassActionXpEvents\(xpResults\)/,
  );
  assert.doesNotMatch(
    automation,
    /for \(const result of xpResults\)[\s\S]*events\.push\(result\.event\)/,
  );
});

test("event schema aceita eliminação como tipo de feedback dominante", () => {
  const event = read(
    "src/lib/shared/progression/battle-pass-game-xp-event.ts",
  );

  assert.match(event, /\| "player_eliminated"/);
  assert.match(event, /"player_eliminated"/);
});

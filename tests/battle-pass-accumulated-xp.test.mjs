import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("modelo acumulativo persiste ações separadas do progresso sazonal", () => {
  const migration = read(
    "src/lib/db/migrations/managed/077-battle-pass-accumulated-xp.sql",
  );
  const actionService = read(
    "src/lib/server/progression/battle-pass-match-action-xp-service.ts",
  );

  assert.match(migration, /progression\.battle_pass_match_progress/);
  assert.match(migration, /progression\.battle_pass_match_xp_actions/);
  assert.match(
    migration,
    /progression\.battle_pass_match_territory_conquests/,
  );
  assert.match(migration, /UNIQUE \(match_id,user_id,source_key\)/);
  assert.match(migration, /settled_reason IN \('match_completed','player_left'\)/);

  assert.doesNotMatch(
    actionService,
    /INSERT INTO progression\.battle_pass_progress/,
  );
  assert.doesNotMatch(
    actionService,
    /INSERT INTO progression\.battle_pass_xp_entries/,
  );
  assert.match(actionService, /scaled_action_xp/);
  assert.match(actionService, /scaleBattlePassXp/);
});

test("perfil V1 acumulativo congela valores e caps definidos no SPEC", () => {
  const migration = read(
    "src/lib/db/migrations/managed/077-battle-pass-accumulated-xp.sql",
  );
  const service = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );

  for (const fragment of [
    "troop_placed_xp INTEGER NOT NULL DEFAULT 1",
    "troop_placed_cap_xp INTEGER NOT NULL DEFAULT 60",
    "card_trade_xp INTEGER NOT NULL DEFAULT 20",
    "card_trade_cap_xp INTEGER NOT NULL DEFAULT 80",
    "troop_lost_dice_xp INTEGER NOT NULL DEFAULT 1",
    "troop_lost_dice_cap_xp INTEGER NOT NULL DEFAULT 50",
    "enemy_troop_defeated_xp INTEGER NOT NULL DEFAULT 2",
    "enemy_troop_defeated_cap_xp INTEGER NOT NULL DEFAULT 100",
    "territory_first_conquest_xp INTEGER NOT NULL DEFAULT 25",
    "territory_second_conquest_xp INTEGER NOT NULL DEFAULT 10",
  ]) {
    assert.ok(migration.includes(fragment), `missing profile rule: ${fragment}`);
  }

  assert.match(service, /profile\.action_model_version/);
  assert.match(service, /troopPlacedXp/);
  assert.match(service, /territorySecondConquestXp/);
});

test("gameplay acumula XP nos pontos autoritativos e movimento continua sem XP", () => {
  const troops = read("src/lib/server/game-troop-command-service.ts");
  const battle = read("src/lib/server/game-battle-service.ts");
  const maneuver = read("src/lib/server/game-maneuver-command-service.ts");

  assert.match(troops, /recordBattlePassTroopsPlaced/);
  assert.match(troops, /recordBattlePassCardTrade/);
  assert.match(troops, /metadata\?\.commandId/);

  assert.match(battle, /recordBattlePassCombat/);
  assert.match(battle, /recordBattlePassTerritoryConquest/);
  assert.match(battle, /battle\.id/);

  assert.doesNotMatch(maneuver, /recordBattlePass/);
});

test("saída voluntária liquida acumulado sem bônus de conclusão ou vitória", () => {
  const exit = read("src/lib/server/game-player-exit-service.ts");
  const settlement = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );

  assert.match(exit, /settleBattlePassPlayerExit/);
  assert.match(
    exit,
    /await settleBattlePassPlayerExit[\s\S]*await markDeparted/,
  );
  assert.match(
    settlement,
    /completed: false,[\s\S]*isWinner: false,[\s\S]*reason: "player_left"/,
  );
});

test("snapshots anteriores ao action model continuam no settlement legado", () => {
  const xp = read("src/lib/shared/progression/battle-pass-xp.ts");
  const settlement = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );

  assert.match(
    xp,
    /row\.actionModelVersion === undefined[\s\S]*\? 1/,
  );
  assert.match(
    settlement,
    /profile\.actionModelVersion < 2[\s\S]*awardLegacyMatchXp/,
  );
});

test("combate usa identidade gerada pelo runtime sem node crypto", () => {
  const combat = read("src/lib/server/game-combat-command-service.ts");

  assert.match(combat, /globalThis\.crypto\.randomUUID\(\)/);
  assert.doesNotMatch(combat, /from "node:crypto"/);
});

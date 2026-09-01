import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("migração de regras de objetivo é expansiva e cobre partidas de 2 a 6 jogadores", () => {
  const migration = source("src/lib/db/migrations/013-objective-rules.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS objective_rules/);
  assert.match(migration, /player_count BETWEEN 2 AND 6/);
  assert.match(migration, /UNIQUE \(objective_id, player_count, revision\)/);
  assert.match(migration, /WHERE is_active = TRUE/);
  assert.match(migration, /generate_series\(2, 6\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS objective_rule_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS resolved_params/);
  assert.doesNotMatch(migration, /DROP COLUMN/);
  assert.doesNotMatch(migration, /DROP TABLE/);
});

test("catálogo usa uma única faixa de balanceamento e metas territoriais proporcionais", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );

  assert.match(migration, /'balanced_territory_control', 2, 1, '\{"territories":30\}'/);
  assert.match(migration, /'balanced_territory_control', 3, 1, '\{"territories":25\}'/);
  assert.match(migration, /'balanced_territory_control', 4, 1, '\{"territories":23\}'/);
  assert.match(migration, /'balanced_territory_control', 5, 1, '\{"territories":21\}'/);
  assert.match(migration, /'balanced_territory_control', 6, 1, '\{"territories":20\}'/);
  assert.doesNotMatch(migration, /'(easy|hard|very_hard)'/);
});

test("fortificação escala por número de jogadores com três tropas por território", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );
  const presentation = source(
    "src/lib/objectives/objective-presentation.ts",
  );

  assert.match(migration, /'balanced_fortification'/);
  assert.match(migration, /'balanced_fortification', 2, 1, '\{"territories":15,"minTroops":3\}'/);
  assert.match(migration, /'balanced_fortification', 3, 1, '\{"territories":10,"minTroops":3\}'/);
  assert.match(migration, /'balanced_fortification', 4, 1, '\{"territories":8,"minTroops":3\}'/);
  assert.match(migration, /'balanced_fortification', 5, 1, '\{"territories":6,"minTroops":3\}'/);
  assert.match(migration, /'balanced_fortification', 6, 1, '\{"territories":5,"minTroops":3\}'/);
  assert.match(presentation, /Mantenha pelo menos \$\{minTroops\} tropas em \$\{territories\} territórios/);
});

test("eliminação só possui regras para quatro a seis jogadores e exige presença territorial", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );
  const service = source("src/lib/game-objective-service.ts");

  assert.doesNotMatch(migration, /'balanced_elimination', [23],/);
  assert.match(migration, /'balanced_elimination', 4, 1, '\{"territories":17\}'/);
  assert.match(migration, /'balanced_elimination', 5, 1, '\{"territories":15\}'/);
  assert.match(migration, /'balanced_elimination', 6, 1, '\{"territories":14\}'/);
  assert.match(service, /const minimumTerritories = numericParam\(objective, "territories"\)/);
  assert.match(service, /minimumTerritories > 0/);
});

test("dois jogadores não recebem combinações regionais curtas", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );

  assert.match(migration, /'balanced_regions_nordeste_centro_oeste', 2,/);
  assert.match(migration, /'balanced_regions_norte_sudeste', 2,/);
  assert.match(migration, /'balanced_regions_nordeste_sul', 2,/);
  assert.doesNotMatch(migration, /'balanced_regions_sul_sudeste_plus', 2,/);
  assert.doesNotMatch(migration, /'balanced_regions_norte_sul', 2,/);
});

test("combinações regionais acompanham a meta territorial de cada tamanho de mesa", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );

  for (const playerCount of [3, 4]) {
    assert.match(
      migration,
      new RegExp(`'balanced_regions_norte_centro_oeste', ${playerCount},`),
    );
    assert.match(
      migration,
      new RegExp(`'balanced_regions_norte_sul', ${playerCount},`),
    );
    assert.match(
      migration,
      new RegExp(`'balanced_regions_nordeste_centro_oeste', ${playerCount},`),
    );
  }

  assert.match(migration, /'balanced_regions_sul_sudeste_plus', 5, 1, '\{"regions":\["sul","sudeste"\],"territories":20\}'/);
  assert.match(migration, /'balanced_regions_sul_sudeste_plus', 6, 1, '\{"regions":\["sul","sudeste"\],"territories":19\}'/);
});

test("region_plus exige regiões e também o piso territorial configurado", () => {
  const service = source("src/lib/game-objective-service.ts");
  const presentation = source(
    "src/lib/objectives/objective-presentation.ts",
  );

  assert.match(service, /objective\.type === "region_plus"/);
  assert.match(service, /ownedIds\.size >= \(numericParam\(objective, "territories"\) \|\| 1\)/);
  assert.match(presentation, /input\.type === "region_plus"/);
});

test("atribuição usa regras balanceadas por quantidade de jogadores e persiste snapshot", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const rooms = source("src/lib/rooms.ts");
  const rematch = source("src/lib/game-finish-command-service.ts");

  assert.match(assignment, /WHERE r\.player_count=\$1/);
  assert.match(assignment, /AND r\.is_active=TRUE/);
  assert.match(assignment, /objective_rule_id,target_player_id,resolved_params/);
  assert.match(assignment, /JSON\.stringify\(rule\.params\)/);
  assert.match(rooms, /await assignObjectives\(client, room\.id, players\)/);
  assert.match(rematch, /await assignObjectives\(client, roomId, players\)/);
});

test("rollout mantém o sorteio legado enquanto a migration ainda não existe no banco", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const compatibility = source(
    "src/lib/objectives/objective-schema-compatibility.ts",
  );

  assert.match(compatibility, /SAVEPOINT objective_rules_compatibility/);
  assert.match(compatibility, /error\.code === "42P01"/);
  assert.match(compatibility, /error\.code === "42703"/);
  assert.match(assignment, /withObjectiveSchemaCompatibility/);
  assert.match(assignment, /assignLegacyObjectives/);
  assert.match(
    assignment,
    /INSERT INTO game_player_objectives[\s\S]*\(room_id,player_id,objective_id,target_player_id\)/,
  );
});

test("avaliação e snapshot usam parâmetros resolvidos sem quebrar atribuições legadas", () => {
  const service = source("src/lib/game-objective-service.ts");
  const snapshot = source("src/lib/game-snapshot-service.ts");
  const presentation = source(
    "src/lib/objectives/objective-presentation.ts",
  );

  assert.match(service, /LEFT JOIN objective_rules r ON r\.id=a\.objective_rule_id/);
  assert.match(service, /CASE WHEN r\.objective_id=a\.objective_id THEN a\.resolved_params END/);
  assert.match(service, /withObjectiveSchemaCompatibility/);
  assert.match(snapshot, /withObjectiveSchemaCompatibility/);
  assert.match(snapshot, /objectiveDescription/);
  assert.match(presentation, /Controle pelo menos \$\{territories\} territórios/);
  assert.match(presentation, /Elimine \{targetPlayer\}/);
});

test("fallback converte apenas quem perdeu o alvo para outro eliminador", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const battle = source("src/lib/game-battle-service.ts");

  assert.match(assignment, /a\.player_id<>\$3/);
  assert.match(assignment, /AND is_active=TRUE/);
  assert.match(assignment, /objective_rule_id=\$4/);
  assert.match(assignment, /resolved_params=\$5::jsonb/);
  assert.match(battle, /battle\.defenderPlayerId,[\s\S]*battle\.attackerPlayerId/);
});

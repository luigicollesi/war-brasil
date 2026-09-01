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

test("domínio territorial deriva a meta de 40% dos territórios inicialmente externos", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );

  const fallbackTargets = new Map([
    [2, 29],
    [3, 25],
    [4, 23],
    [5, 22],
    [6, 21],
  ]);
  for (const [playerCount, territories] of fallbackTargets) {
    assert.match(
      migration,
      new RegExp(
        `'balanced_territory_control', ${playerCount}, 1, '\\\{"unownedTerritoryPercent":40,"territories":${territories}\\\}'`,
      ),
    );
  }

  assert.match(assignment, /rule\.objective_id === "balanced_territory_control"/);
  assert.match(assignment, /unownedTerritoryPercent <= 0/);
  assert.match(assignment, /unownedTerritoryPercent > 100/);
  assert.match(
    assignment,
    /territoriesOutsideInitialControl =\s*totalTerritories - initialTerritories/,
  );
  assert.match(
    assignment,
    /Math\.round\([\s\S]*territoriesOutsideInitialControl \* unownedTerritoryPercent[\s\S]*\/ 100/,
  );
  assert.match(assignment, /return \{ territories \}/);
  assert.doesNotMatch(migration, /'(easy|hard|very_hard)'/);
});

test("fortificação usa 100-110% da posse inicial real e exige quatro tropas", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const presentation = source(
    "src/lib/objectives/objective-presentation.ts",
  );

  assert.match(migration, /'balanced_fortification'/);
  for (const playerCount of [2, 3, 4, 5, 6]) {
    assert.match(
      migration,
      new RegExp(
        `'balanced_fortification', ${playerCount}, 1, '\\\{"initialTerritoryPercent":110,"minTroops":4\\\}'`,
      ),
    );
  }
  assert.match(assignment, /rule\.objective_id === "balanced_fortification"/);
  assert.match(assignment, /initialTerritoryPercent < 100/);
  assert.match(assignment, /initialTerritoryPercent > 110/);
  assert.match(assignment, /!positiveInteger\(minTroops\)/);
  assert.match(assignment, /COUNT\(\*\) FILTER \(WHERE owner_player_id=\$2\)/);
  assert.match(
    assignment,
    /Math\.floor\(\(initialTerritories \* initialTerritoryPercent\) \/ 100\)/,
  );
  assert.match(assignment, /return \{ territories, minTroops \}/);
  assert.match(presentation, /Mantenha pelo menos \$\{minTroops\} tropas em \$\{territories\} territórios/);
});

test("regras balanceadas inválidas interrompem atribuição em vez de persistir snapshot inseguro", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );

  assert.match(
    assignment,
    /A regra de fortificação balanceada possui parâmetros inválidos/,
  );
  assert.match(
    assignment,
    /A regra de domínio territorial balanceado possui parâmetros inválidos/,
  );
  assert.match(assignment, /throw new ObjectiveConfigurationError/);
});

test("eliminação só entra de quatro a seis jogadores e usa piso territorial auxiliar", () => {
  const migration = source(
    "src/lib/db/migrations/014-balanced-objective-catalog.sql",
  );
  const service = source("src/lib/game-objective-service.ts");

  assert.doesNotMatch(migration, /'balanced_elimination', [23],/);
  assert.match(migration, /'balanced_elimination', 4, 1, '\{"territories":14\}'/);
  assert.match(migration, /'balanced_elimination', 5, 1, '\{"territories":12\}'/);
  assert.match(migration, /'balanced_elimination', 6, 1, '\{"territories":10\}'/);
  assert.match(migration, /piso territorial serve apenas para impedir/);
  assert.match(service, /hasTerritoryFloor/);
  assert.match(service, /positiveIntegerParam\(objective, "territories"\)/);
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

test("combinações regionais acompanham a referência territorial de cada mesa", () => {
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

test("avaliação falha fechada quando resolved_params está ausente ou inválido", () => {
  const service = source("src/lib/game-objective-service.ts");

  assert.match(service, /function positiveIntegerParam/);
  assert.match(service, /requiredTerritories !== null/);
  assert.match(service, /minimumTroops !== null/);
  assert.match(
    service,
    /\(objective\.type === "regions" \|\| objective\.type === "region_plus"\)[\s\S]*required === null/,
  );
  assert.match(service, /minimumTerritories !== null/);
});

test("region_plus exige regiões válidas e também o piso territorial configurado", () => {
  const service = source("src/lib/game-objective-service.ts");
  const presentation = source(
    "src/lib/objectives/objective-presentation.ts",
  );

  assert.match(service, /objective\.type === "region_plus"/);
  assert.match(
    service,
    /minimumTerritories !== null && ownedIds\.size >= minimumTerritories/,
  );
  assert.match(presentation, /input\.type === "region_plus"/);
});

test("atribuição usa regras balanceadas por quantidade de jogadores e persiste snapshot resolvido", () => {
  const assignment = source(
    "src/lib/objectives/objective-assignment-service.ts",
  );
  const rooms = source("src/lib/rooms.ts");
  const rematch = source("src/lib/game-finish-command-service.ts");

  assert.match(assignment, /WHERE r\.player_count=\$1/);
  assert.match(assignment, /AND r\.is_active=TRUE/);
  assert.match(assignment, /objective_rule_id,target_player_id,resolved_params/);
  assert.match(assignment, /const resolvedParams = await resolveAssignmentParams/);
  assert.match(assignment, /JSON\.stringify\(resolvedParams\)/);
  assert.match(rooms, /await assignObjectives\(client, room\.id, players\)/);
  assert.match(rematch, /await assignObjectives\(client, roomId, players\)/);
});

test("schema migrado é obrigatório e erros de tabela ou coluna não caem no catálogo legado", () => {
  const compatibility = source(
    "src/lib/objectives/objective-schema-compatibility.ts",
  );

  assert.match(compatibility, /return primary\(\)/);
  assert.doesNotMatch(compatibility, /SAVEPOINT objective_rules_compatibility/);
  assert.doesNotMatch(compatibility, /42P01/);
  assert.doesNotMatch(compatibility, /42703/);
});

test("avaliação e snapshot usam os parâmetros resolvidos do schema atual", () => {
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

test("eliminação por terceiro mantém a missão e avalia seu dono", () => {
  const migration = source(
    "src/lib/db/migrations/016-disable-elimination-fallback.sql",
  );
  const battle = source("src/lib/game-battle-service.ts");

  assert.match(migration, /SET fallback_objective_id = NULL/);
  assert.match(migration, /type IN \('elimination', 'elimination_plus'\)/);
  assert.match(battle, /function evaluateEliminationObjectiveOwners/);
  assert.match(battle, /a\.target_player_id=\$2/);
  assert.match(battle, /o\.type IN \('elimination','elimination_plus'\)/);
  assert.match(battle, /candidate\.player_id/);
  assert.match(battle, /"territory_control_changed"/);
  assert.doesNotMatch(battle, /resolveObjectiveFallbacks/);
});

test("fortificação é reavaliada após manobra e bônus positivo de evento", () => {
  const maneuver = source("src/lib/game-maneuver-command-service.ts");
  const command = source("src/lib/game-command-service.ts");

  assert.match(
    maneuver,
    /objectiveWon\(client, room\.id, player\.id, "troops_changed"\)/,
  );
  assert.match(maneuver, /winnerPlayerId: player\.id/);
  assert.match(command, /function evaluateRoundTroopObjectiveWinners/);
  assert.match(
    command,
    /roundActivation\.appliedTroopChanges\.some\(\(change\) => change\.delta > 0\)/,
  );
  assert.match(
    command,
    /objectiveWon\(client, roomId, candidate\.id, "troops_changed"\)/,
  );
});

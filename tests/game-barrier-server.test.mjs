import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("combate persiste o modo de ataque e mantém compatibilidade com batalhas antigas", () => {
  const battle = source("src/lib/server/game-battle-service.ts");
  const contract = source("src/lib/shared/game-contract.ts");
  const combat = source("src/lib/server/game-combat-command-service.ts");

  assert.match(battle, /attackMode\?: AttackMode/);
  assert.match(battle, /barrierName\?: string \| null/);
  assert.match(battle, /export function battleAttackMode/);
  assert.match(battle, /battle\.attackMode === "barrier" \? "barrier" : "normal"/);

  assert.match(contract, /attackMode\?: AttackMode/);
  assert.match(contract, /barrierName\?: string \| null/);

  assert.match(combat, /attackMode,/);
  assert.match(combat, /barrierName: attackMode === "barrier"/);
});

test("structural sharing considera modo e nome da barreira como parte da batalha", () => {
  const sharing = source("src/lib/game-snapshot-sharing.ts");

  assert.match(sharing, /left\.attackMode === right\.attackMode/);
  assert.match(sharing, /left\.barrierName === right\.barrierName/);
});

test("fronteira efetiva bloqueada vira ataque de barreira em vez de ser rejeitada", () => {
  const combat = source("src/lib/server/game-combat-command-service.ts");

  assert.match(combat, /getEffectiveGameTopology/);
  assert.match(
    combat,
    /findTerritoryConnection\(\s*topology\.connections,\s*input\.fromTerritoryId,\s*input\.toTerritoryId,?\s*\)/,
  );
  assert.match(combat, /if \(!connection\.exists\)/);
  assert.match(combat, /connection\.passable \? "normal" : "barrier"/);
  assert.doesNotMatch(combat, /getBaseTerritoryConnection/);
  assert.doesNotMatch(combat, /isJurassicTunnelConnection/);
  assert.doesNotMatch(combat, /if \(!connection\.passable\)/);
});

test("servidor usa attackProfile tanto para validar quanto para rolar dados", () => {
  const combat = source("src/lib/server/game-combat-command-service.ts");

  assert.match(combat, /attackProfile\(attacker\.troops, attackMode\)/);
  assert.match(combat, /attackProfile\(attacker\.troops, battleAttackMode\(battle\)\)/);
  assert.match(combat, /\{ length: profile\.diceCount \}/);
  assert.doesNotMatch(combat, /Math\.min\(3, attacker\.troops - 1\)/);
});

test("perdas do atacante multiplicam as comparações pelo perfil da barreira", () => {
  const combat = source("src/lib/server/game-combat-command-service.ts");
  const battle = source("src/lib/server/game-battle-service.ts");

  assert.match(
    combat,
    /resolved\.attackerLosses \* profile\.attackerLossPerComparison/,
  );
  assert.match(combat, /battle\.attackerLosses = attackerLosses/);
  assert.match(combat, /battle\.defenderLosses = resolved\.defenderLosses/);
  assert.match(combat, /if \(attackerLosses >= attacker\.troops\)/);
  assert.match(battle, /if \(attackerTroops < MIN_TERRITORY_TROOPS\)/);
});

test("Túnel Jurássico continua sendo passagem normal mesmo sobre fronteira bloqueada", () => {
  const combat = source("src/lib/server/game-combat-command-service.ts");
  const effective = source("src/lib/shared/game-effective-connections.ts");
  const connections = source("src/lib/shared/territory-connections.ts");

  assert.match(combat, /getEffectiveGameTopology/);
  assert.match(combat, /connection\.passable \? "normal" : "barrier"/);
  assert.match(effective, /applyEventConnectionEffects/);
  assert.match(effective, /effectiveTerritoryConnections\(/);
  assert.ok(
    effective.indexOf("applyEventConnectionEffects") <
      effective.lastIndexOf("effectiveTerritoryConnections"),
  );
  assert.match(connections, /find\(\(connection\) => connection\.passable\)/);
});

test("manobra usa topologia efetiva completa e recalcula a melhor rota no servidor", () => {
  const maneuver = source("src/lib/server/game-maneuver-command-service.ts");

  assert.match(maneuver, /getEffectiveGameTopology/);
  assert.match(maneuver, /bestTerritoryRoute/);
  assert.match(maneuver, /topology\.connections/);
  assert.match(maneuver, /maneuverTraversalProfile\(route\.barrierCount\)/);
  assert.doesNotMatch(maneuver, /getBaseTerritoryConnections/);
  assert.doesNotMatch(maneuver, /effectiveTerritoryConnections/);
  assert.doesNotMatch(maneuver, /getPassableTerritoryConnections/);
  assert.doesNotMatch(maneuver, /reachableTerritoryIds/);
  assert.doesNotMatch(maneuver, /FROM territory_connections/);
});

test("manobra rejeita duas barreiras e exige duas tropas para uma travessia", () => {
  const maneuver = source("src/lib/server/game-maneuver-command-service.ts");

  assert.match(maneuver, /traversal\.kind === "blocked"/);
  assert.match(maneuver, /minimumBarrierCount: route\.barrierCount/);
  assert.match(maneuver, /troops < traversal\.minimumTroops/);
});

test("penalidade de manobra remove N da origem mas entrega apenas N menos a perda", () => {
  const maneuver = source("src/lib/server/game-maneuver-command-service.ts");

  assert.match(
    maneuver,
    /const troopsArriving = input\.troops - traversal\.troopLoss/,
  );
  assert.match(maneuver, /\[room\.id, input\.fromTerritoryId, input\.troops\]/);
  assert.match(maneuver, /\[room\.id, input\.toTerritoryId, troopsArriving\]/);
  assert.match(
    maneuver,
    /SET troops=troops\+\$3,moved_in_turn=moved_in_turn\+\$3/,
  );
});

test("cliente não informa ao servidor se a manobra atravessa barreira", () => {
  const maneuver = source("src/lib/server/game-maneuver-command-service.ts");

  assert.doesNotMatch(maneuver, /input\.barrier/);
  assert.doesNotMatch(maneuver, /input\.crossesBarrier/);
  assert.match(maneuver, /bestTerritoryRoute\(/);
});

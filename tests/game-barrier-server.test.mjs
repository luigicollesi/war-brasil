import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("combate persiste o modo de ataque e mantém compatibilidade com batalhas antigas", () => {
  const battle = source("src/lib/game-battle-service.ts");
  const contract = source("src/lib/game-contract.ts");
  const combat = source("src/lib/game-combat-command-service.ts");

  assert.match(battle, /attackMode\?: AttackMode/);
  assert.match(battle, /barrierName\?: string \| null/);
  assert.match(battle, /export function battleAttackMode/);
  assert.match(battle, /battle\.attackMode === "barrier" \? "barrier" : "normal"/);

  assert.match(contract, /attackMode\?: AttackMode/);
  assert.match(contract, /barrierName\?: string \| null/);

  assert.match(combat, /attackMode,/);
  assert.match(combat, /barrierName: attackMode === "barrier"/);
});

test("fronteira existente bloqueada vira ataque de barreira em vez de ser rejeitada", () => {
  const combat = source("src/lib/game-combat-command-service.ts");

  assert.match(combat, /if \(!tunnelActive && !connection\.exists\)/);
  assert.match(combat, /attackModeForConnection\(tunnelActive, connection\.passable\)/);
  assert.match(combat, /return tunnelActive \|\| passable \? "normal" : "barrier"/);
  assert.doesNotMatch(combat, /if \(!tunnelActive && !connection\.passable\)/);
});

test("servidor usa attackProfile tanto para validar quanto para rolar dados", () => {
  const combat = source("src/lib/game-combat-command-service.ts");

  assert.match(combat, /attackProfile\(attacker\.troops, attackMode\)/);
  assert.match(combat, /attackProfile\(attacker\.troops, battleAttackMode\(battle\)\)/);
  assert.match(combat, /\{ length: profile\.diceCount \}/);
  assert.doesNotMatch(combat, /Math\.min\(3, attacker\.troops - 1\)/);
});

test("perdas do atacante multiplicam as comparações pelo perfil da barreira", () => {
  const combat = source("src/lib/game-combat-command-service.ts");
  const battle = source("src/lib/game-battle-service.ts");

  assert.match(
    combat,
    /resolved\.attackerLosses \* profile\.attackerLossPerComparison/,
  );
  assert.match(combat, /battle\.attackerLosses = attackerLosses/);
  assert.match(combat, /battle\.defenderLosses = resolved\.defenderLosses/);
  assert.match(combat, /if \(attackerLosses >= attacker\.troops\)/);
  assert.match(battle, /if \(attackerTroops < 1\)/);
});

test("Túnel Jurássico continua sendo passagem normal mesmo sobre fronteira bloqueada", () => {
  const combat = source("src/lib/game-combat-command-service.ts");

  assert.match(combat, /isJurassicTunnelConnection/);
  assert.match(combat, /return tunnelActive \|\| passable \? "normal" : "barrier"/);
});

test("manobra usa topologia completa e recalcula a melhor rota no servidor", () => {
  const maneuver = source("src/lib/game-maneuver-command-service.ts");

  assert.match(maneuver, /getBaseTerritoryConnections/);
  assert.match(maneuver, /effectiveTerritoryConnections/);
  assert.match(maneuver, /bestTerritoryRoute/);
  assert.match(maneuver, /maneuverTraversalProfile\(route\.barrierCount\)/);
  assert.doesNotMatch(maneuver, /getPassableTerritoryConnections/);
  assert.doesNotMatch(maneuver, /reachableTerritoryIds/);
});

test("manobra rejeita duas barreiras e exige duas tropas para uma travessia", () => {
  const maneuver = source("src/lib/game-maneuver-command-service.ts");

  assert.match(maneuver, /traversal\.kind === "blocked"/);
  assert.match(maneuver, /minimumBarrierCount: route\.barrierCount/);
  assert.match(maneuver, /troops < traversal\.minimumTroops/);
});

test("penalidade de manobra remove N da origem mas entrega apenas N menos a perda", () => {
  const maneuver = source("src/lib/game-maneuver-command-service.ts");

  assert.match(maneuver, /const troopsArriving = troops - traversal\.troopLoss/);
  assert.match(maneuver, /\[room\.id, from, troops\]/);
  assert.match(maneuver, /\[room\.id, to, troopsArriving\]/);
  assert.match(
    maneuver,
    /SET troops=troops\+\$3,moved_in_turn=moved_in_turn\+\$3/,
  );
});

test("cliente não informa ao servidor se a manobra atravessa barreira", () => {
  const maneuver = source("src/lib/game-maneuver-command-service.ts");

  assert.doesNotMatch(maneuver, /input\.barrier/);
  assert.doesNotMatch(maneuver, /input\.crossesBarrier/);
  assert.match(maneuver, /bestTerritoryRoute\(/);
});

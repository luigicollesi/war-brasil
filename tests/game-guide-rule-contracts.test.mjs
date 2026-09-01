import assert from "node:assert/strict";
import test from "node:test";
import {
  MANDATORY_TRADE_HAND_SIZE,
  maneuverMovableTroops,
  MIN_TERRITORY_TROOPS,
  OWNED_TERRITORY_CARD_BONUS,
  reinforcementBase,
  reinforcementFor,
  resolveBattle,
  isValidTrade,
  tradeValue,
} from "../.test-build/game-rules.js";
import {
  attackProfile,
  maneuverTraversalProfile,
} from "../.test-build/game-barrier-rules.js";
import { buildGameGuidePresentation } from "../.test-build/game-guide-presentation.js";
import { TERRITORY_METADATA } from "../.test-build/game-config.js";
import { PLAYER_COLORS } from "../.test-build/lobby.js";
import {
  eligibleOrderPlayerIds,
} from "../.test-build/game-order-rules.js";
import {
  JURASSIC_TUNNEL_EXCLUDED_TERRITORY_ID,
  JURASSIC_TUNNEL_SOURCE_ID,
  jurassicTunnelCandidates,
} from "../.test-build/game-round-rules.js";
import {
  jurassicTunnelConnection,
} from "../.test-build/territory-connections.js";
import { bestTerritoryRoute } from "../.test-build/territory-routing.js";

function connection(territoryA, territoryB, passable, barrierName = null) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName,
    description: null,
  };
}

test("limites compartilhados do manual são as mesmas constantes do domínio", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(PLAYER_COLORS.length, 6);
  assert.equal(guide.setup.initialTroopsPerTerritory, MIN_TERRITORY_TROOPS);
  assert.equal(guide.conquest.minimumMove, MIN_TERRITORY_TROOPS);
  assert.equal(guide.conquest.minimumTroopsLeftAtOrigin, MIN_TERRITORY_TROOPS);
  assert.equal(guide.maneuver.minimumTroopsLeftAtOrigin, MIN_TERRITORY_TROOPS);
  assert.equal(guide.anomalies.minimumTroopsAfterRemoval, MIN_TERRITORY_TROOPS);
  assert.equal(guide.cards.mandatoryTradeHandSize, MANDATORY_TRADE_HAND_SIZE);
  assert.equal(guide.cards.ownedTerritoryBonus, OWNED_TERRITORY_CARD_BONUS);
});

test("reforços do guia acompanham cálculo base e bônus regionais", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(guide.reinforcement.baseExample, reinforcementBase(guide.reinforcement.territoryExample));
  assert.equal(
    guide.reinforcement.minimumExample.final,
    reinforcementBase(guide.reinforcement.minimumExample.territoryCount),
  );

  for (const region of guide.regions) {
    const territoryIds = Object.entries(TERRITORY_METADATA)
      .filter(([, territory]) => territory.region === region.key)
      .map(([id]) => Number(id));

    assert.equal(territoryIds.length, region.territoryCount);
    assert.equal(
      reinforcementFor(territoryIds),
      reinforcementBase(territoryIds.length) + region.bonus,
    );
  }
});

test("dados e exemplo de combate do guia são derivados das regras de batalha", () => {
  const guide = buildGameGuidePresentation();

  for (const band of guide.attack.normalDiceBands) {
    const profile = attackProfile(band.minimumTroops, "normal");
    assert.equal(profile.kind, "available");
    assert.equal(profile.diceCount, band.diceCount);
  }

  for (const band of guide.attack.barrierDiceBands) {
    const profile = attackProfile(band.minimumTroops, "barrier");
    assert.equal(profile.kind, "available");
    assert.equal(profile.diceCount, band.diceCount);
    assert.equal(profile.attackerLossPerComparison, guide.attack.barrierLossPerComparison);
  }

  const resolved = resolveBattle([6, 4, 2], [5, 4]);
  assert.equal(resolved.attackerLosses, guide.combat.example.attackerLosses);
  assert.equal(resolved.defenderLosses, guide.combat.example.defenderLosses);
  assert.deepEqual(resolved.attacker.slice(2), guide.combat.example.unpairedAttack);
});

test("combinações alcançáveis e progressão do guia acompanham isValidTrade e tradeValue", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(isValidTrade(["leaf", "leaf", "leaf"]), true);
  assert.equal(isValidTrade(["leaf", "gold", "water"]), true);
  assert.equal(isValidTrade(["leaf", "leaf", "wild"]), true);
  assert.equal(isValidTrade(["leaf", "leaf", "gold"]), false);
  assert.equal(isValidTrade(["leaf", "gold"]), false);

  assert.deepEqual(
    guide.cards.tradeValues,
    guide.cards.tradeValues.map((_, index) => tradeValue(index)),
  );
  assert.equal(
    guide.cards.incrementPerPersonalTrade,
    tradeValue(1) - tradeValue(0),
  );
});

test("manobra preserva uma tropa, impede remanobra e prefere rota com menos Barreiras", () => {
  const guide = buildGameGuidePresentation();

  assert.equal(maneuverMovableTroops(5, 0), 4);
  assert.equal(maneuverMovableTroops(5, 2), 2);
  assert.equal(
    guide.maneuver.example.movableAfterReceiving,
    maneuverMovableTroops(
      guide.maneuver.example.sourceTroops,
      guide.maneuver.example.alreadyMoved,
    ),
  );

  assert.equal(maneuverTraversalProfile(0).kind, "normal");
  assert.equal(maneuverTraversalProfile(1).kind, "barrier");
  assert.equal(maneuverTraversalProfile(2).kind, "blocked");

  const route = bestTerritoryRoute(
    [
      connection(1, 2, false, "Barreira direta"),
      connection(1, 3, true),
      connection(3, 2, true),
    ],
    1,
    2,
    [1, 2, 3],
  );

  assert.equal(route.kind, "reachable");
  assert.deepEqual(route.path, [1, 3, 2]);
  assert.equal(route.barrierCount, 0);
});

test("ordem só mantém empatados elegíveis para nova rolagem", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const firstRound = [
    { player_id: "a", roll_round: 1, value: 6 },
    { player_id: "b", roll_round: 1, value: 6 },
    { player_id: "c", roll_round: 1, value: 4 },
  ];

  assert.deepEqual(eligibleOrderPlayerIds(players, firstRound, 2), ["a", "b"]);
});

test("Túnel Jurássico sai do Acre, evita destinos proibidos e é transitável", () => {
  const candidates = jurassicTunnelCandidates([1, 2, 3, 4, 5], 4);

  assert.equal(candidates.includes(JURASSIC_TUNNEL_SOURCE_ID), false);
  assert.equal(candidates.includes(JURASSIC_TUNNEL_EXCLUDED_TERRITORY_ID), false);
  assert.equal(candidates.includes(4), false);
  assert.deepEqual(candidates, [2, 5]);

  const tunnel = jurassicTunnelConnection(18);
  assert.ok(tunnel);
  assert.equal(tunnel.territoryA, JURASSIC_TUNNEL_SOURCE_ID);
  assert.equal(tunnel.territoryB, 18);
  assert.equal(tunnel.exists, true);
  assert.equal(tunnel.passable, true);
});

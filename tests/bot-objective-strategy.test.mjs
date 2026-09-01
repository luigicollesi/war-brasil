import assert from "node:assert/strict";
import test from "node:test";
import { TERRITORY_METADATA } from "../.test-build/game-config.js";
import {
  buildObjectivePlan,
  evaluateObjectiveProgress,
} from "../.test-build/bots/bot-objective-plan.js";
import { territoryStrategicValues } from "../.test-build/bots/bot-territory-value.js";
import { chooseCardTrade } from "../.test-build/bots/bot-cards.js";

function connection(territoryA, territoryB, passable = true) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName: passable ? null : "Barreira",
    description: null,
  };
}

function allTerritories(owner = "30") {
  return Object.keys(TERRITORY_METADATA).map((id) => ({
    territoryId: Number(id),
    ownerPlayerId: owner,
    troops: 2,
    movedInTurn: 0,
  }));
}

function state(overrides = {}) {
  return {
    room: {
      id: "1",
      phase: "reinforcement",
      roundNumber: 1,
      reinforcementsRemaining: 3,
    },
    bot: { id: "10", cardTradeCount: 0 },
    objective: {
      type: "territories",
      params: { territories: 5 },
      targetPlayerId: null,
    },
    cards: [],
    players: [
      { id: "10", turnPosition: 1, isBot: true },
      { id: "20", turnPosition: 2, isBot: false },
      { id: "30", turnPosition: 3, isBot: false },
    ],
    territories: allTerritories(),
    topology: {
      connections: [],
      eventId: 0,
      resolvedEventEffects: [],
    },
    ...overrides,
  };
}

function idsForRegion(region) {
  return Object.entries(TERRITORY_METADATA)
    .filter(([, metadata]) => metadata.region === region)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

test("regions aponta apenas territórios faltantes da região e protege os já dominados", () => {
  const sul = idsForRegion("sul");
  const missing = sul[0];
  const territories = allTerritories().map((territory) =>
    sul.includes(territory.territoryId) && territory.territoryId !== missing
      ? { ...territory, ownerPlayerId: "10" }
      : territory,
  );
  const strategicState = state({
    objective: {
      type: "regions",
      params: { regions: ["sul"] },
      targetPlayerId: null,
    },
    territories,
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);

  assert.deepEqual(plan, { kind: "region", regions: ["sul"] });
  assert.deepEqual(progress.primaryTargets, [missing]);
  assert.equal(progress.immediateWinPossible, true);
  assert.deepEqual(
    progress.protectedTerritories,
    sul.filter((id) => id !== missing),
  );
});

test("region_plus prioriza progresso regional antes de expansão externa", () => {
  const sul = idsForRegion("sul");
  const missingRegion = sul[0];
  const ownedRegion = sul[1];
  const outsideIds = Object.keys(TERRITORY_METADATA)
    .map(Number)
    .filter((id) => !sul.includes(id));
  const ownedOutside = outsideIds[0];
  const externalTarget = outsideIds[1];

  const territories = allTerritories().map((territory) => {
    if (territory.territoryId === ownedRegion || territory.territoryId === ownedOutside) {
      return { ...territory, ownerPlayerId: "10", troops: 4 };
    }
    if (sul.includes(territory.territoryId) && territory.territoryId !== missingRegion) {
      return { ...territory, ownerPlayerId: "10", troops: 3 };
    }
    return territory;
  });

  const strategicState = state({
    objective: {
      type: "region_plus",
      params: { regions: ["sul"], territories: sul.length + 4 },
      targetPlayerId: null,
    },
    territories,
    topology: {
      connections: [
        connection(ownedRegion, missingRegion),
        connection(ownedOutside, externalTarget),
      ],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);

  assert.equal(plan.kind, "region_territories");
  assert.deepEqual(progress.primaryTargets, [missingRegion]);
  assert.ok(progress.routeTargets.includes(externalTarget));
});

test("eliminação persegue somente o alvo enquanto ele está vivo", () => {
  const territories = allTerritories().map((territory) => {
    if (territory.territoryId === 1 || territory.territoryId === 2) {
      return { ...territory, ownerPlayerId: "20" };
    }
    if (territory.territoryId === 3 || territory.territoryId === 4) {
      return { ...territory, ownerPlayerId: "10", troops: 5 };
    }
    return territory;
  });
  const strategicState = state({
    objective: {
      type: "elimination",
      params: { territories: 4 },
      targetPlayerId: "20",
    },
    territories,
    topology: {
      connections: [connection(3, 1), connection(4, 5)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);

  assert.deepEqual(progress.primaryTargets, [1, 2]);
  assert.ok(!progress.primaryTargets.includes(5));
});

test("eliminação concluída por terceiro muda estratégia para completar o piso territorial", () => {
  const territories = allTerritories().map((territory) => {
    if (territory.territoryId === 3 || territory.territoryId === 4) {
      return { ...territory, ownerPlayerId: "10", troops: 5 };
    }
    return territory.ownerPlayerId === "20"
      ? { ...territory, ownerPlayerId: "30" }
      : territory;
  });
  const strategicState = state({
    objective: {
      type: "elimination",
      params: { territories: 3 },
      targetPlayerId: "20",
    },
    territories,
    topology: {
      connections: [connection(3, 5)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);

  assert.equal(progress.missingTerritories, 1);
  assert.deepEqual(progress.primaryTargets, [5]);
  assert.equal(progress.immediateWinPossible, true);
});

test("objetivo legado desconhecido cai em expansão genérica sem redefinir vitória", () => {
  const strategicState = state({
    objective: {
      type: "network",
      params: { territories: 10 },
      targetPlayerId: null,
    },
    territories: allTerritories().map((territory) =>
      territory.territoryId === 1
        ? { ...territory, ownerPlayerId: "10", troops: 5 }
        : territory,
    ),
    topology: {
      connections: [connection(1, 2)],
      eventId: 0,
      resolvedEventEffects: [],
    },
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);
  assert.deepEqual(plan, { kind: "generic_expansion" });
  assert.deepEqual(progress.primaryTargets, [2]);
  assert.equal(progress.immediateWinPossible, false);
});

test("troca opcional é valorizada quando o bônus de território completa fortification", () => {
  const territories = allTerritories().map((territory) =>
    territory.territoryId === 1
      ? { ...territory, ownerPlayerId: "10", troops: 2 }
      : territory,
  );
  const strategicState = state({
    objective: {
      type: "fortification",
      params: { territories: 1, minTroops: 4 },
      targetPlayerId: null,
    },
    territories,
    cards: [
      { id: "1", territoryId: 1, symbol: "leaf", isWild: false },
      { id: "2", territoryId: 2, symbol: "leaf", isWild: false },
      { id: "3", territoryId: 3, symbol: "leaf", isWild: false },
    ],
  });

  const plan = buildObjectivePlan(strategicState);
  const progress = evaluateObjectiveProgress(strategicState, plan);
  const values = territoryStrategicValues(strategicState, plan, progress);
  const action = chooseCardTrade(strategicState, plan, progress, values);

  assert.equal(action?.type, "trade_cards");
  assert.deepEqual(action.cardIds, ["1", "2", "3"]);
});

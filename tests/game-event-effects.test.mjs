import assert from "node:assert/strict";
import test from "node:test";
import { isAttackOriginBlocked } from "../.test-build/events/event-attack-rules.js";
import { resolveEventEffects } from "../.test-build/events/event-resolver.js";
import { applyEventConnectionEffects } from "../.test-build/events/event-topology.js";
import {
  EventConfigurationError,
  parseResolvedEventEffects,
} from "../.test-build/events/event-types.js";
import { effectiveGameConnections } from "../.test-build/game-effective-connections.js";

function connection(
  territoryA,
  territoryB,
  passable,
  barrierName = null,
  description = null,
) {
  return {
    territoryA,
    territoryB,
    exists: true,
    passable,
    barrierName,
    description,
  };
}

test("efeitos fixos usam pares canônicos e não mutam a topologia base", () => {
  const base = [
    connection(1, 2, false, "Serra"),
    connection(1, 3, true),
  ];
  const original = structuredClone(base);

  const resolved = resolveEventEffects({
    effects: [
      { type: "OPEN_CONNECTIONS", connections: [[2, 1]] },
      { type: "BLOCK_CONNECTIONS", connections: [[3, 1]] },
    ],
    baseConnections: base,
    randomIndex: () => 0,
  });

  assert.deepEqual(resolved, [
    { type: "OPEN_CONNECTIONS", connections: [[1, 2]] },
    { type: "BLOCK_CONNECTIONS", connections: [[1, 3]] },
  ]);

  const effective = applyEventConnectionEffects(base, resolved);
  assert.equal(effective[0].passable, true);
  assert.equal(effective[0].barrierName, null);
  assert.equal(effective[1].passable, false);
  assert.deepEqual(base, original);
});

test("uma conexão não pode receber duas alterações no mesmo evento", () => {
  const base = [connection(1, 2, false, "Serra")];

  assert.throws(
    () =>
      resolveEventEffects({
        effects: [
          { type: "OPEN_CONNECTIONS", connections: [[1, 2]] },
          { type: "OPEN_CONNECTIONS", connections: [[2, 1]] },
        ],
        baseConnections: base,
        randomIndex: () => 0,
      }),
    EventConfigurationError,
  );
});

test("efeitos fixos só alteram conexões compatíveis com a topologia base", () => {
  const base = [connection(1, 2, true)];

  assert.throws(
    () =>
      resolveEventEffects({
        effects: [{ type: "OPEN_CONNECTIONS", connections: [[1, 2]] }],
        baseConnections: base,
        randomIndex: () => 0,
      }),
    EventConfigurationError,
  );
});

test("random open e block escolhem somente candidatos elegíveis e respeitam proteção", () => {
  const base = [
    connection(1, 2, false, "Serra A"),
    connection(1, 3, false, "Serra B"),
    connection(2, 3, true),
    connection(2, 4, true),
  ];

  const resolved = resolveEventEffects({
    effects: [
      { type: "RANDOM_OPEN_CONNECTIONS", count: 1 },
      { type: "RANDOM_BLOCK_CONNECTIONS", count: 1 },
    ],
    baseConnections: base,
    protectedConnections: [[1, 3]],
    randomIndex: () => 0,
  });

  assert.deepEqual(resolved, [
    { type: "RANDOM_OPEN_CONNECTIONS", connections: [[1, 2]] },
    { type: "RANDOM_BLOCK_CONNECTIONS", connections: [[2, 3]] },
  ]);
});

test("sorteios de conexão são sem reposição e falham quando count excede candidatos", () => {
  const base = [
    connection(1, 2, false, "A"),
    connection(1, 3, false, "B"),
  ];

  const resolved = resolveEventEffects({
    effects: [{ type: "RANDOM_OPEN_CONNECTIONS", count: 2 }],
    baseConnections: base,
    randomIndex: () => 0,
  });
  assert.deepEqual(resolved[0].connections, [
    [1, 2],
    [1, 3],
  ]);

  assert.throws(
    () =>
      resolveEventEffects({
        effects: [{ type: "RANDOM_OPEN_CONNECTIONS", count: 3 }],
        baseConnections: base,
        randomIndex: () => 0,
      }),
    EventConfigurationError,
  );
});

test("RANDOM_TOGGLE_CONNECTIONS move a barreira para outro caminho do mesmo território", () => {
  const base = [
    connection(18, 23, false, "Serra da Mantiqueira", "Travessia montanhosa"),
    connection(18, 19, true),
    connection(18, 20, true),
  ];
  const original = structuredClone(base);

  const resolved = resolveEventEffects({
    effects: [{ type: "RANDOM_TOGGLE_CONNECTIONS", count: 1 }],
    baseConnections: base,
    randomIndex: () => 0,
  });

  assert.deepEqual(resolved, [
    {
      type: "RANDOM_TOGGLE_CONNECTIONS",
      moves: [
        {
          anchorTerritoryId: 18,
          from: [18, 23],
          to: [18, 19],
          barrierName: "Serra da Mantiqueira",
          description: "Travessia montanhosa",
        },
      ],
    },
  ]);

  const effective = applyEventConnectionEffects(base, resolved);
  const source = effective.find(
    (item) => item.territoryA === 18 && item.territoryB === 23,
  );
  const target = effective.find(
    (item) => item.territoryA === 18 && item.territoryB === 19,
  );

  assert.equal(source.passable, true);
  assert.equal(source.barrierName, null);
  assert.equal(target.passable, false);
  assert.equal(target.barrierName, "Serra da Mantiqueira");
  assert.equal(target.description, "Travessia montanhosa");
  assert.deepEqual(base, original);
});

test("barreira relocada não usa conexão protegida como destino", () => {
  const base = [
    connection(18, 23, false, "Serra"),
    connection(18, 19, true),
    connection(18, 20, true),
  ];

  const resolved = resolveEventEffects({
    effects: [{ type: "RANDOM_TOGGLE_CONNECTIONS", count: 1 }],
    baseConnections: base,
    protectedConnections: [[18, 19]],
    randomIndex: () => 0,
  });

  assert.deepEqual(resolved[0].moves[0].to, [18, 20]);
});

test("barreira não pode ser relocada quando não existe outro caminho elegível", () => {
  assert.throws(
    () =>
      resolveEventEffects({
        effects: [{ type: "RANDOM_TOGGLE_CONNECTIONS", count: 1 }],
        baseConnections: [connection(18, 23, false, "Serra")],
        randomIndex: () => 0,
      }),
    EventConfigurationError,
  );
});

test("Túnel Jurássico é composto depois do overlay do evento", () => {
  const effective = effectiveGameConnections(
    [connection(3, 20, true)],
    [{ type: "BLOCK_CONNECTIONS", connections: [[3, 20]] }],
    20,
  );

  const samePair = effective.filter(
    (item) => item.territoryA === 3 && item.territoryB === 20,
  );
  assert.equal(samePair.some((item) => item.passable === false), true);
  assert.equal(
    samePair.some(
      (item) => item.passable === true && item.barrierName === "Túnel Jurássico",
    ),
    true,
  );
});

test("BLOCK_ATTACK bloqueia somente a origem listada", () => {
  const effects = parseResolvedEventEffects([
    { type: "BLOCK_ATTACK", territories: [18] },
  ]);

  assert.equal(isAttackOriginBlocked(effects, 18), true);
  assert.equal(isAttackOriginBlocked(effects, 19), false);
});

test("parser de efeitos resolvidos valida identidade e exclusividade das barreiras", () => {
  assert.throws(
    () =>
      parseResolvedEventEffects([
        {
          type: "RANDOM_TOGGLE_CONNECTIONS",
          moves: [
            {
              anchorTerritoryId: 18,
              from: [18, 23],
              to: [18, 19],
              barrierName: "Serra",
              description: null,
            },
            {
              anchorTerritoryId: 18,
              from: [18, 23],
              to: [18, 20],
              barrierName: "Serra",
              description: null,
            },
          ],
        },
      ]),
    EventConfigurationError,
  );
});

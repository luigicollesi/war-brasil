import assert from "node:assert/strict";
import test from "node:test";
import { buildTemporalAnomalyPresentation } from "../.test-build/events/event-presentation.js";

function present(activeEvent, roundNumber = 4) {
  return buildTemporalAnomalyPresentation({
    roundNumber,
    activeEvent,
  });
}

test("evento inicial apresenta a tropa inicial como benefício sem efeito mecânico factual", () => {
  const presentation = present(
    {
      eventId: 0,
      name: "País em Prosperidade — Tudo Sob Controle",
      description: "Tudo parece perfeitamente normal.",
      resolvedEffects: [],
      appliedTroopChanges: [],
    },
    1,
  );

  assert.equal(presentation?.key, "1:0");
  assert.equal(presentation?.roundNumber, 1);
  assert.equal(presentation?.eyebrow, "ANOMALIA TEMPORAL");
  assert.equal(presentation?.title, "País em Prosperidade — Tudo Sob Controle");
  assert.deepEqual(presentation?.effects, [
    {
      kind: "troops-added",
      label: "+1 tropa",
      primary: "Todos os territórios",
    },
  ]);
  assert.equal("tunnelMessage" in (presentation ?? {}), false);
  assert.equal("contextMessage" in (presentation ?? {}), false);
});

test("mudanças de tropas usam o delta realmente aplicado", () => {
  const presentation = present({
    eventId: 12,
    name: "Evento",
    description: "Descrição",
    resolvedEffects: [
      { type: "ADD_TROOPS", territories: [20], amount: 3 },
      { type: "REMOVE_TROOPS", territories: [22], amount: 3 },
    ],
    appliedTroopChanges: [
      {
        type: "ADD_TROOPS",
        territoryId: 20,
        beforeTroops: 2,
        afterTroops: 5,
        delta: 3,
      },
      {
        type: "REMOVE_TROOPS",
        territoryId: 22,
        beforeTroops: 2,
        afterTroops: 1,
        delta: -1,
      },
    ],
  });

  assert.deepEqual(presentation?.effects, [
    {
      kind: "troops-added",
      label: "+3 tropas",
      primary: "São Paulo Oeste",
    },
    {
      kind: "troops-removed",
      label: "−1 tropa",
      primary: "Rio de Janeiro",
    },
  ]);
});

test("remoção limitada ao mínimo vira informação compacta", () => {
  const presentation = present({
    eventId: 13,
    name: "Evento",
    description: "Descrição",
    resolvedEffects: [{ type: "REMOVE_TROOPS", territories: [22], amount: 3 }],
    appliedTroopChanges: [
      {
        type: "REMOVE_TROOPS",
        territoryId: 22,
        beforeTroops: 1,
        afterTroops: 1,
        delta: 0,
      },
    ],
  });

  assert.deepEqual(presentation?.effects[0], {
    kind: "troops-removed",
    label: "Tropa mínima",
    primary: "Rio de Janeiro",
    secondary: "Nenhuma tropa removida",
  });
});

test("efeitos territoriais usam nomes e rótulos compactos", () => {
  const presentation = present({
    eventId: 14,
    name: "Evento",
    description: "Descrição",
    appliedTroopChanges: [],
    resolvedEffects: [
      { type: "BLOCK_ATTACK", territories: [18] },
      { type: "OPEN_CONNECTIONS", connections: [[18, 23]] },
      { type: "RANDOM_BLOCK_CONNECTIONS", connections: [[20, 35]] },
    ],
  });

  assert.deepEqual(presentation?.effects, [
    {
      kind: "attack-blocked",
      label: "Ataques bloqueados",
      primary: "Goiás",
    },
    {
      kind: "connection-opened",
      label: "Conexão aberta",
      primary: "Goiás ↔ Bahia Oeste-Sul",
    },
    {
      kind: "connection-blocked",
      label: "Conexão bloqueada",
      primary: "São Paulo Oeste ↔ Minas Centro-Sul",
    },
  ]);
});

test("movimento de barreira preserva nome, origem e destino", () => {
  const presentation = present({
    eventId: 15,
    name: "Evento",
    description: "Descrição",
    appliedTroopChanges: [],
    resolvedEffects: [
      {
        type: "RANDOM_TOGGLE_CONNECTIONS",
        moves: [
          {
            anchorTerritoryId: 18,
            from: [18, 23],
            to: [18, 35],
            barrierName: "Serra Temporal",
            description: null,
          },
        ],
      },
    ],
  });

  assert.deepEqual(presentation?.effects[0], {
    kind: "barrier-moved",
    label: "Barreira reposicionada",
    primary: "Serra Temporal",
    secondary: "Goiás ↔ Bahia Oeste-Sul → Goiás ↔ Minas Centro-Sul",
  });
});

test("rodadas normais usam chave composta por rodada e evento", () => {
  const event = {
    eventId: 12,
    name: "Evento",
    description: "Descrição",
    appliedTroopChanges: [],
    resolvedEffects: [],
  };

  assert.equal(present(event, 4)?.key, "4:12");
  assert.equal(present(event, 8)?.key, "8:12");
});

test("sem evento não existe apresentação ativa", () => {
  assert.equal(
    buildTemporalAnomalyPresentation({
      roundNumber: 1,
      activeEvent: null,
    }),
    null,
  );
});

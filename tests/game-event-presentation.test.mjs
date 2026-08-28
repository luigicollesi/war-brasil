import assert from "node:assert/strict";
import test from "node:test";
import { buildTemporalAnomalyPresentation } from "../.test-build/events/event-presentation.js";

function present(activeEvent, roundNumber = 4, tunnel = 22) {
  return buildTemporalAnomalyPresentation({
    roundNumber,
    jurassicTunnelDestinationId: tunnel,
    activeEvent,
  });
}

test("evento inicial é narrativo e não anuncia reforço adicional", () => {
  const presentation = present(
    {
      eventId: 0,
      name: "País em Prosperidade — Tudo Sob Controle",
      description: "Tudo parece perfeitamente normal.",
      resolvedEffects: [],
      appliedTroopChanges: [],
    },
    1,
    18,
  );

  assert.equal(presentation?.key, "1:0");
  assert.match(presentation?.eyebrow ?? "", /RODADA 1/);
  assert.match(presentation?.tunnelMessage ?? "", /se manifestou/);
  assert.match(presentation?.tunnelMessage ?? "", /Goiás/);
  assert.equal(presentation?.changesHeading, "ESTADO DA PARTIDA");
  assert.deepEqual(
    presentation?.changes.map((change) => change.text),
    [
      "Todos os territórios já iniciam com 1 tropa.",
      "Nenhum reforço adicional foi aplicado.",
    ],
  );
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

  assert.deepEqual(
    presentation?.changes.map((change) => change.text),
    [
      "São Paulo Oeste recebeu 3 tropas.",
      "Rio de Janeiro perdeu 1 tropa.",
    ],
  );
});

test("remoção limitada ao mínimo informa que nenhuma tropa pôde ser removida", () => {
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

  assert.equal(
    presentation?.changes[0]?.text,
    "Rio de Janeiro permaneceu com a tropa mínima.",
  );
});

test("efeitos territoriais usam nomes e semântica correta", () => {
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

  const texts = presentation?.changes.map((change) => change.text) ?? [];
  assert.equal(texts[0], "Goiás não pode iniciar ataques nesta rodada.");
  assert.equal(
    texts[1],
    "A passagem entre Goiás e Bahia Oeste-Sul foi aberta.",
  );
  assert.equal(
    texts[2],
    "A passagem entre São Paulo Oeste e Minas Centro-Sul foi bloqueada.",
  );
  assert.doesNotMatch(texts.join(" "), /território 18|território 23|território 20/i);
});

test("movimento de barreira preserva o nome e descreve origem e destino", () => {
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

  assert.equal(
    presentation?.changes[0]?.text,
    "Serra Temporal mudou de Goiás ↔ Bahia Oeste-Sul para Goiás ↔ Minas Centro-Sul.",
  );
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
  assert.match(present(event, 4)?.tunnelMessage ?? "", /mudou de destino/);
});

test("sem evento ou sem túnel não existe apresentação ativa", () => {
  assert.equal(
    buildTemporalAnomalyPresentation({
      roundNumber: 1,
      jurassicTunnelDestinationId: 18,
      activeEvent: null,
    }),
    null,
  );

  assert.equal(
    buildTemporalAnomalyPresentation({
      roundNumber: 1,
      jurassicTunnelDestinationId: null,
      activeEvent: {
        eventId: 0,
        name: "Evento",
        description: "Descrição",
        resolvedEffects: [],
        appliedTroopChanges: [],
      },
    }),
    null,
  );
});

import { TERRITORY_METADATA } from "../game-config";
import { INITIAL_EVENT_ID } from "./event-catalog";
import type {
  AppliedEventTroopChange,
  ResolvedEventEffect,
  TerritoryConnectionPair,
} from "./event-types";

export type TemporalAnomalyChangeKind =
  | "troops-added"
  | "troops-removed"
  | "attack-blocked"
  | "connection-opened"
  | "connection-blocked"
  | "barrier-moved"
  | "information";

export type TemporalAnomalyChange = {
  kind: TemporalAnomalyChangeKind;
  text: string;
};

export type TemporalAnomalyPresentation = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  tunnelMessage: string;
  contextMessage: string;
  changesHeading: string;
  changes: TemporalAnomalyChange[];
};

type PresentableEvent = {
  eventId: number;
  name: string;
  description: string;
  resolvedEffects: ResolvedEventEffect[];
  appliedTroopChanges: AppliedEventTroopChange[];
};

function territoryName(territoryId: number) {
  return TERRITORY_METADATA[territoryId]?.name ?? `Território ${territoryId}`;
}

function troopWord(amount: number) {
  return amount === 1 ? "tropa" : "tropas";
}

function connectionNames(pair: TerritoryConnectionPair) {
  return `${territoryName(pair[0])} ↔ ${territoryName(pair[1])}`;
}

function troopChangeText(change: AppliedEventTroopChange): TemporalAnomalyChange {
  if (change.type === "ADD_TROOPS") {
    const amount = change.delta;
    return {
      kind: "troops-added",
      text: `${territoryName(change.territoryId)} recebeu ${amount} ${troopWord(amount)}.`,
    };
  }

  const removed = Math.abs(change.delta);
  if (removed === 0) {
    return {
      kind: "troops-removed",
      text: `${territoryName(change.territoryId)} permaneceu com a tropa mínima.`,
    };
  }

  return {
    kind: "troops-removed",
    text: `${territoryName(change.territoryId)} perdeu ${removed} ${troopWord(removed)}.`,
  };
}

function resolvedEffectChanges(effect: ResolvedEventEffect): TemporalAnomalyChange[] {
  switch (effect.type) {
    case "ADD_TROOPS":
    case "REMOVE_TROOPS":
      return [];

    case "BLOCK_ATTACK":
      return effect.territories.map((territoryId) => ({
        kind: "attack-blocked" as const,
        text: `${territoryName(territoryId)} não pode iniciar ataques nesta rodada.`,
      }));

    case "OPEN_CONNECTIONS":
    case "RANDOM_OPEN_CONNECTIONS":
      return effect.connections.map((connection) => ({
        kind: "connection-opened" as const,
        text: `A passagem entre ${territoryName(connection[0])} e ${territoryName(connection[1])} foi aberta.`,
      }));

    case "BLOCK_CONNECTIONS":
    case "RANDOM_BLOCK_CONNECTIONS":
      return effect.connections.map((connection) => ({
        kind: "connection-blocked" as const,
        text: `A passagem entre ${territoryName(connection[0])} e ${territoryName(connection[1])} foi bloqueada.`,
      }));

    case "RANDOM_TOGGLE_CONNECTIONS":
      return effect.moves.map((move) => ({
        kind: "barrier-moved" as const,
        text: `${move.barrierName ?? "Uma barreira"} mudou de ${connectionNames(move.from)} para ${connectionNames(move.to)}.`,
      }));
  }
}

function normalRoundChanges(event: PresentableEvent) {
  const changes = [
    ...event.appliedTroopChanges.map(troopChangeText),
    ...event.resolvedEffects.flatMap(resolvedEffectChanges),
  ];

  return changes.length > 0
    ? changes
    : [
        {
          kind: "information" as const,
          text: "Nenhuma alteração mecânica adicional foi aplicada nesta rodada.",
        },
      ];
}

export function buildTemporalAnomalyPresentation(input: {
  roundNumber: number;
  jurassicTunnelDestinationId: number | null;
  activeEvent: PresentableEvent | null;
}): TemporalAnomalyPresentation | null {
  const { roundNumber, jurassicTunnelDestinationId, activeEvent } = input;
  if (!activeEvent || jurassicTunnelDestinationId === null) return null;

  const destination = territoryName(jurassicTunnelDestinationId);
  const isInitial = activeEvent.eventId === INITIAL_EVENT_ID;

  return {
    key: `${roundNumber}:${activeEvent.eventId}`,
    eyebrow: `ANOMALIA TEMPORAL · RODADA ${roundNumber}`,
    title: activeEvent.name,
    description: activeEvent.description,
    tunnelMessage: isInitial
      ? `O Túnel Jurássico se manifestou. Acre agora está conectado a ${destination}.`
      : `O Túnel Jurássico mudou de destino. Acre agora está conectado a ${destination}.`,
    contextMessage: isInitial
      ? "A ruptura provocou anomalias temporais em todo o país, recriando acontecimentos do passado."
      : "A mudança provocou novas anomalias temporais em todo o país, recriando acontecimentos do passado.",
    changesHeading: isInitial ? "ESTADO DA PARTIDA" : "O QUE MUDOU NESTA RODADA",
    changes: isInitial
      ? [
          {
            kind: "information",
            text: "Todos os territórios já iniciam com 1 tropa.",
          },
          {
            kind: "information",
            text: "Nenhum reforço adicional foi aplicado.",
          },
        ]
      : normalRoundChanges(activeEvent),
  };
}

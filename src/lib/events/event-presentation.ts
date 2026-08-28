import { TERRITORY_METADATA } from "../game-config";
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

export type TemporalAnomalyEffectPresentation = {
  kind: TemporalAnomalyChangeKind;
  label: string;
  primary: string;
  secondary?: string;
};

export type TemporalAnomalyPresentation = {
  key: string;
  roundNumber: number;
  eyebrow: string;
  title: string;
  description: string;
  effects: TemporalAnomalyEffectPresentation[];
};

type PresentableEvent = {
  eventId: number;
  name: string;
  description: string;
  resolvedEffects: ResolvedEventEffect[];
  appliedTroopChanges: AppliedEventTroopChange[];
};

function territoryName(territoryId: number) {
  return TERRITORY_METADATA[territoryId]?.name ?? "Território desconhecido";
}

function troopWord(amount: number) {
  return amount === 1 ? "tropa" : "tropas";
}

function connectionNames(pair: TerritoryConnectionPair) {
  return `${territoryName(pair[0])} ↔ ${territoryName(pair[1])}`;
}

function troopChange(
  change: AppliedEventTroopChange,
): TemporalAnomalyEffectPresentation {
  if (change.type === "ADD_TROOPS") {
    return {
      kind: "troops-added",
      label: `+${change.delta} ${troopWord(change.delta)}`,
      primary: territoryName(change.territoryId),
    };
  }

  const removed = Math.abs(change.delta);
  if (removed === 0) {
    return {
      kind: "troops-removed",
      label: "Tropa mínima",
      primary: territoryName(change.territoryId),
      secondary: "Nenhuma tropa removida",
    };
  }

  return {
    kind: "troops-removed",
    label: `−${removed} ${troopWord(removed)}`,
    primary: territoryName(change.territoryId),
  };
}

function resolvedEffectPresentations(
  effect: ResolvedEventEffect,
): TemporalAnomalyEffectPresentation[] {
  switch (effect.type) {
    case "ADD_TROOPS":
    case "REMOVE_TROOPS":
      return [];

    case "BLOCK_ATTACK":
      return effect.territories.map((territoryId) => ({
        kind: "attack-blocked" as const,
        label: "Ataques bloqueados",
        primary: territoryName(territoryId),
      }));

    case "OPEN_CONNECTIONS":
    case "RANDOM_OPEN_CONNECTIONS":
      return effect.connections.map((connection) => ({
        kind: "connection-opened" as const,
        label: "Conexão aberta",
        primary: connectionNames(connection),
      }));

    case "BLOCK_CONNECTIONS":
    case "RANDOM_BLOCK_CONNECTIONS":
      return effect.connections.map((connection) => ({
        kind: "connection-blocked" as const,
        label: "Conexão bloqueada",
        primary: connectionNames(connection),
      }));

    case "RANDOM_TOGGLE_CONNECTIONS":
      return effect.moves.map((move) => ({
        kind: "barrier-moved" as const,
        label: "Barreira reposicionada",
        primary: move.barrierName ?? "Barreira natural",
        secondary: `${connectionNames(move.from)} → ${connectionNames(move.to)}`,
      }));
  }
}

function eventEffects(event: PresentableEvent) {
  return [
    ...event.appliedTroopChanges.map(troopChange),
    ...event.resolvedEffects.flatMap(resolvedEffectPresentations),
  ];
}

export function buildTemporalAnomalyPresentation(input: {
  roundNumber: number;
  activeEvent: PresentableEvent | null;
}): TemporalAnomalyPresentation | null {
  const { roundNumber, activeEvent } = input;
  if (!activeEvent) return null;

  return {
    key: `${roundNumber}:${activeEvent.eventId}`,
    roundNumber,
    eyebrow: "ANOMALIA TEMPORAL",
    title: activeEvent.name,
    description: activeEvent.description,
    effects: eventEffects(activeEvent),
  };
}

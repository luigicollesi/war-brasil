import type { GameSnapshot } from "@/src/lib/game-contract";
import type { GameViewModel } from "@/src/lib/game-view-model";
import {
  reachableTerritoryIds,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";

type GameInteractionDialog =
  | { kind: "reinforce"; targetId: number }
  | { kind: "maneuver"; sourceId: number; targetId: number }
  | null;

type GameInteractionState = {
  scopeKey: string;
  sourceId: number | null;
  dialog: GameInteractionDialog;
  barrier: TerritoryConnection | null;
};

type GameInteractionAction =
  | { type: "select-source"; scopeKey: string; territoryId: number }
  | { type: "open-reinforce"; scopeKey: string; territoryId: number }
  | {
      type: "open-maneuver";
      scopeKey: string;
      sourceId: number;
      targetId: number;
    }
  | { type: "show-barrier"; scopeKey: string; connection: TerritoryConnection }
  | { type: "clear-dialog"; scopeKey: string }
  | { type: "clear-selection"; scopeKey: string }
  | { type: "clear-barrier"; scopeKey: string };

type MapHints = {
  available: number[];
  targets: number[];
};

type InteractionArrow = {
  fromTerritoryId: number;
  toTerritoryId: number;
  kind: "movement";
} | null;

export function gameInteractionScopeKey(snapshot: GameSnapshot) {
  const battle = snapshot.room.battle;
  const pending = snapshot.room.pendingConquest;
  return [
    snapshot.room.turnNumber,
    snapshot.room.phase,
    snapshot.room.currentPlayerId ?? "-",
    battle?.stage ?? "-",
    pending ? `${pending.fromTerritoryId}-${pending.toTerritoryId}` : "-",
  ].join(":");
}

export function initialGameInteractionState(scopeKey: string): GameInteractionState {
  return {
    scopeKey,
    sourceId: null,
    dialog: null,
    barrier: null,
  };
}

export function effectiveGameInteractionState(
  state: GameInteractionState,
  scopeKey: string,
) {
  return state.scopeKey === scopeKey
    ? state
    : initialGameInteractionState(scopeKey);
}

export function gameInteractionReducer(
  state: GameInteractionState,
  action: GameInteractionAction,
): GameInteractionState {
  const current = effectiveGameInteractionState(state, action.scopeKey);

  if (action.type === "select-source") {
    return {
      ...current,
      sourceId:
        current.sourceId === action.territoryId ? null : action.territoryId,
      dialog: null,
      barrier: null,
    };
  }

  if (action.type === "open-reinforce") {
    return {
      ...current,
      sourceId: null,
      dialog: { kind: "reinforce", targetId: action.territoryId },
      barrier: null,
    };
  }

  if (action.type === "open-maneuver") {
    return {
      ...current,
      sourceId: action.sourceId,
      dialog: {
        kind: "maneuver",
        sourceId: action.sourceId,
        targetId: action.targetId,
      },
      barrier: null,
    };
  }

  if (action.type === "show-barrier") {
    return { ...current, barrier: action.connection };
  }

  if (action.type === "clear-dialog") {
    return { ...current, dialog: null };
  }

  if (action.type === "clear-selection") {
    return { ...current, sourceId: null, dialog: null, barrier: null };
  }

  return { ...current, barrier: null };
}

export function maneuverTargetIds(
  snapshot: GameSnapshot,
  game: GameViewModel,
  sourceId: number,
) {
  return reachableTerritoryIds(
    snapshot.connections,
    sourceId,
    game.myTerritories.map((territory) => territory.territoryId),
  ).filter((territoryId) => territoryId !== sourceId);
}

export function attackTargetIds(game: GameViewModel, sourceId: number) {
  const connections = game.connectionsByTerritory.get(sourceId) ?? [];
  const meId = game.me?.id;

  return connections
    .filter((connection) => connection.passable)
    .map((connection) =>
      connection.territoryA === sourceId
        ? connection.territoryB
        : connection.territoryA,
    )
    .filter(
      (territoryId) =>
        game.territoriesById.get(territoryId)?.ownerPlayerId !== meId,
    );
}

export function deriveMapHints(
  snapshot: GameSnapshot,
  game: GameViewModel,
  state: GameInteractionState,
): MapHints {
  const isTurn =
    snapshot.room.status === "playing" &&
    snapshot.room.currentPlayerId === game.me?.id;

  if (!isTurn || snapshot.room.battle) return { available: [], targets: [] };

  if (snapshot.room.phase === "reinforcement") {
    return {
      available: game.myTerritories.map((territory) => territory.territoryId),
      targets: [],
    };
  }

  if (snapshot.room.phase === "attack") {
    return state.sourceId === null
      ? {
          available: game.myTerritories
            .filter((territory) => territory.troops > 1)
            .map((territory) => territory.territoryId),
          targets: [],
        }
      : {
          available: [],
          targets: attackTargetIds(game, state.sourceId),
        };
  }

  if (snapshot.room.phase === "maneuver") {
    return state.sourceId === null
      ? {
          available: game.myTerritories
            .filter(
              (territory) => territory.troops - territory.movedInTurn > 1,
            )
            .map((territory) => territory.territoryId),
          targets: [],
        }
      : {
          available: [],
          targets: maneuverTargetIds(snapshot, game, state.sourceId),
        };
  }

  return { available: [], targets: [] };
}

export function deriveInteractionArrow(
  state: GameInteractionState,
): InteractionArrow {
  return state.dialog?.kind === "maneuver"
    ? {
        fromTerritoryId: state.dialog.sourceId,
        toTerritoryId: state.dialog.targetId,
        kind: "movement",
      }
    : null;
}

export function deriveSelectedTerritoryId(state: GameInteractionState) {
  if (state.dialog?.kind === "reinforce") return state.dialog.targetId;
  if (state.dialog?.kind === "maneuver") return state.dialog.targetId;
  return state.sourceId;
}

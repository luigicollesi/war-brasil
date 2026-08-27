import type { GameSnapshot } from "./game-contract";
import {
  attackProfile,
  maneuverTraversalProfile,
} from "./game-barrier-rules";
import { maneuverMovableTroops } from "./game-rules";
import type { GameViewModel } from "./game-view-model";
import { bestTerritoryRoutes } from "./territory-routing";

export type ManeuverTraversalHint =
  | {
      kind: "normal";
      troopLoss: 0;
      minimumTroops: 1;
    }
  | {
      kind: "barrier";
      troopLoss: 1;
      minimumTroops: 2;
      barrierName: string | null;
    };

export type MapTargetHint =
  | {
      territoryId: number;
      kind: "normal";
      selectable: true;
    }
  | {
      territoryId: number;
      kind: "barrier-attack";
      selectable: boolean;
      barrierName: string | null;
      minimumTroops: number;
    }
  | {
      territoryId: number;
      kind: "barrier-maneuver";
      selectable: boolean;
      barrierName: string | null;
      troopLoss: 1;
      minimumTroops: 2;
    };

export type MapHints = {
  available: number[];
  targets: MapTargetHint[];
};

type GameInteractionDialog =
  | { kind: "reinforce"; targetId: number }
  | {
      kind: "maneuver";
      sourceId: number;
      targetId: number;
      traversal: ManeuverTraversalHint;
    }
  | null;

type GameInteractionState = {
  scopeKey: string;
  sourceId: number | null;
  dialog: GameInteractionDialog;
};

type GameInteractionAction =
  | { type: "select-source"; scopeKey: string; territoryId: number }
  | { type: "open-reinforce"; scopeKey: string; territoryId: number }
  | {
      type: "open-maneuver";
      scopeKey: string;
      sourceId: number;
      targetId: number;
      traversal: ManeuverTraversalHint;
    }
  | { type: "clear-dialog"; scopeKey: string }
  | { type: "clear-selection"; scopeKey: string };

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
    };
  }

  if (action.type === "open-reinforce") {
    return {
      ...current,
      sourceId: null,
      dialog: { kind: "reinforce", targetId: action.territoryId },
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
        traversal: action.traversal,
      },
    };
  }

  if (action.type === "clear-dialog") {
    return { ...current, dialog: null };
  }

  return { ...current, sourceId: null, dialog: null };
}

export function attackTargetHints(
  game: GameViewModel,
  sourceId: number,
): MapTargetHint[] {
  const source = game.territoriesById.get(sourceId);
  const meId = game.me?.id;
  if (!source || !meId || source.ownerPlayerId !== meId) return [];

  const byTerritory = new Map<number, MapTargetHint>();

  for (const connection of game.connectionsByTerritory.get(sourceId) ?? []) {
    if (!connection.exists) continue;

    const territoryId =
      connection.territoryA === sourceId
        ? connection.territoryB
        : connection.territoryA;
    const target = game.territoriesById.get(territoryId);
    if (!target || target.ownerPlayerId === meId) continue;

    const profile = attackProfile(
      source.troops,
      connection.passable ? "normal" : "barrier",
    );
    const hint: MapTargetHint | null = connection.passable
      ? profile.kind === "available"
        ? { territoryId, kind: "normal", selectable: true }
        : null
      : {
          territoryId,
          kind: "barrier-attack",
          selectable: profile.kind === "available",
          barrierName: connection.barrierName,
          minimumTroops: profile.minimumTroops,
        };

    if (!hint) continue;

    const current = byTerritory.get(territoryId);
    // Uma passagem normal (por exemplo, Túnel Jurássico) sempre vence uma
    // conexão base bloqueada para o mesmo par de territórios.
    if (!current || (current.kind !== "normal" && hint.kind === "normal")) {
      byTerritory.set(territoryId, hint);
    }
  }

  return Array.from(byTerritory.values()).sort(
    (left, right) => left.territoryId - right.territoryId,
  );
}

export function maneuverTargetHints(
  snapshot: GameSnapshot,
  game: GameViewModel,
  sourceId: number,
): MapTargetHint[] {
  const source = game.territoriesById.get(sourceId);
  if (!source || source.ownerPlayerId !== game.me?.id) return [];

  const movableTroops = maneuverMovableTroops(
    source.troops,
    source.movedInTurn,
  );
  const routes = bestTerritoryRoutes(
    snapshot.connections,
    sourceId,
    game.myTerritories.map((territory) => territory.territoryId),
  );
  const targets: MapTargetHint[] = [];

  for (const territory of game.myTerritories) {
    if (territory.territoryId === sourceId) continue;

    const route = routes.get(territory.territoryId);
    if (!route || route.kind === "unreachable") continue;

    const traversal = maneuverTraversalProfile(route.barrierCount);
    if (traversal.kind === "blocked") continue;

    if (traversal.kind === "normal") {
      if (movableTroops >= traversal.minimumTroops) {
        targets.push({
          territoryId: territory.territoryId,
          kind: "normal",
          selectable: true,
        });
      }
      continue;
    }

    targets.push({
      territoryId: territory.territoryId,
      kind: "barrier-maneuver",
      selectable: movableTroops >= traversal.minimumTroops,
      barrierName: route.barriers[0]?.barrierName ?? null,
      troopLoss: traversal.troopLoss,
      minimumTroops: traversal.minimumTroops,
    });
  }

  return targets.sort((left, right) => left.territoryId - right.territoryId);
}

export function maneuverTraversalFromTarget(
  target: MapTargetHint,
): ManeuverTraversalHint | null {
  if (target.kind === "normal") {
    return { kind: "normal", troopLoss: 0, minimumTroops: 1 };
  }
  if (target.kind === "barrier-maneuver") {
    return {
      kind: "barrier",
      troopLoss: target.troopLoss,
      minimumTroops: target.minimumTroops,
      barrierName: target.barrierName,
    };
  }
  return null;
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
          targets: attackTargetHints(game, state.sourceId),
        };
  }

  if (snapshot.room.phase === "maneuver") {
    return state.sourceId === null
      ? {
          available: game.myTerritories
            .filter(
              (territory) =>
                maneuverMovableTroops(
                  territory.troops,
                  territory.movedInTurn,
                ) > 0,
            )
            .map((territory) => territory.territoryId),
          targets: [],
        }
      : {
          available: [],
          targets: maneuverTargetHints(snapshot, game, state.sourceId),
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

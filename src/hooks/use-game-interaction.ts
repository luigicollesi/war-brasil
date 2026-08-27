"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { maneuverMovableTroops } from "@/src/lib/game-rules";
import type { GameViewModel } from "@/src/lib/game-view-model";
import {
  deriveInteractionArrow,
  deriveMapHints,
  deriveSelectedTerritoryId,
  effectiveGameInteractionState,
  gameInteractionReducer,
  gameInteractionScopeKey,
  initialGameInteractionState,
  maneuverTargetIds,
} from "@/src/lib/game-interaction";
import { runGameCommand } from "@/src/lib/game-command-client";
import { findTerritoryConnection } from "@/src/lib/territory-connections";

type UseGameInteractionInput = {
  roomId: string;
  snapshot: GameSnapshot;
  game: GameViewModel;
  refresh: (minimumRevision?: number) => Promise<void>;
};

export function useGameInteraction({
  roomId,
  snapshot,
  game,
  refresh,
}: UseGameInteractionInput) {
  const scopeKey = gameInteractionScopeKey(snapshot);
  const [rawState, dispatch] = useReducer(
    gameInteractionReducer,
    scopeKey,
    initialGameInteractionState,
  );
  const [message, setMessage] = useState("");
  const state = effectiveGameInteractionState(rawState, scopeKey);

  const mapHints = useMemo(
    () => deriveMapHints(snapshot, game, state),
    [game, snapshot, state],
  );
  const arrow = useMemo(() => deriveInteractionArrow(state), [state]);
  const selectedTerritoryId = deriveSelectedTerritoryId(state);

  const clearSelection = useCallback(() => {
    dispatch({ type: "clear-selection", scopeKey });
  }, [scopeKey]);

  const clearDialog = useCallback(() => {
    dispatch({ type: "clear-dialog", scopeKey });
  }, [scopeKey]);

  const clearBarrier = useCallback(() => {
    dispatch({ type: "clear-barrier", scopeKey });
  }, [scopeKey]);

  const onTerritoryClick = useCallback(
    (territoryId: number) => {
      const meId = game.me?.id;
      const territory = game.territoriesById.get(territoryId);
      const isTurn =
        snapshot.room.status === "playing" &&
        snapshot.room.currentPlayerId === meId;

      if (!territory || !meId || !isTurn || snapshot.room.battle) return;
      setMessage("");

      if (snapshot.room.phase === "reinforcement") {
        if (territory.ownerPlayerId === meId) {
          dispatch({ type: "open-reinforce", scopeKey, territoryId });
        }
        return;
      }

      if (snapshot.room.phase === "attack") {
        if (state.sourceId === null) {
          if (territory.ownerPlayerId === meId && territory.troops > 1) {
            dispatch({ type: "select-source", scopeKey, territoryId });
          }
          return;
        }

        if (territoryId === state.sourceId) {
          clearSelection();
          return;
        }

        const connection = findTerritoryConnection(
          snapshot.connections,
          state.sourceId,
          territoryId,
        );

        if (
          territory.ownerPlayerId !== meId &&
          connection.exists &&
          connection.passable
        ) {
          const sourceId = state.sourceId;
          void runGameCommand(
            roomId,
            "attack",
            { fromTerritoryId: sourceId, toTerritoryId: territoryId },
            "Não foi possível iniciar o ataque.",
          )
            .then(async (result) => {
              dispatch({ type: "clear-selection", scopeKey });
              await refresh(result.revision ?? undefined);
            })
            .catch((error: unknown) => {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Não foi possível iniciar o ataque.",
              );
            });
          return;
        }

        if (connection.exists && !connection.passable) {
          dispatch({ type: "show-barrier", scopeKey, connection });
        }
        return;
      }

      if (snapshot.room.phase === "maneuver") {
        if (state.sourceId === null) {
          if (
            territory.ownerPlayerId === meId &&
            maneuverMovableTroops(
              territory.troops,
              territory.movedInTurn,
            ) > 0
          ) {
            dispatch({ type: "select-source", scopeKey, territoryId });
          }
          return;
        }

        if (territoryId === state.sourceId) {
          clearSelection();
          return;
        }

        const targets = maneuverTargetIds(snapshot, game, state.sourceId);
        if (territory.ownerPlayerId === meId && targets.includes(territoryId)) {
          dispatch({
            type: "open-maneuver",
            scopeKey,
            sourceId: state.sourceId,
            targetId: territoryId,
          });
          return;
        }

        const directConnection = findTerritoryConnection(
          snapshot.connections,
          state.sourceId,
          territoryId,
        );
        if (directConnection.exists && !directConnection.passable) {
          dispatch({
            type: "show-barrier",
            scopeKey,
            connection: directConnection,
          });
        }
      }
    },
    [
      clearSelection,
      game,
      refresh,
      roomId,
      scopeKey,
      snapshot,
      state.sourceId,
    ],
  );

  return {
    state,
    sourceId: state.sourceId,
    dialog: state.dialog,
    barrier: state.barrier,
    message,
    mapHints,
    arrow,
    selectedTerritoryId,
    onTerritoryClick,
    clearSelection,
    clearDialog,
    clearBarrier,
  };
}

export type GameInteractionController = ReturnType<typeof useGameInteraction>;

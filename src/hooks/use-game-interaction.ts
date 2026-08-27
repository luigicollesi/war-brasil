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
  maneuverTraversalFromTarget,
} from "@/src/lib/game-interaction";
import { runGameCommand } from "@/src/lib/game-command-client";

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

        const targetHint = mapHints.targets.find(
          (hint) => hint.territoryId === territoryId,
        );
        if (!targetHint || territory.ownerPlayerId === meId) return;

        if (!targetHint.selectable) {
          if (targetHint.kind === "barrier-attack") {
            setMessage(
              targetHint.barrierName
                ? `Ataques através de ${targetHint.barrierName} exigem pelo menos ${targetHint.minimumTroops} tropas.`
                : `Ataques através desta barreira exigem pelo menos ${targetHint.minimumTroops} tropas.`,
            );
          }
          return;
        }

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

        const targetHint = mapHints.targets.find(
          (hint) => hint.territoryId === territoryId,
        );
        if (!targetHint || territory.ownerPlayerId !== meId) return;

        if (!targetHint.selectable) {
          if (targetHint.kind === "barrier-maneuver") {
            setMessage(
              targetHint.barrierName
                ? `A travessia de ${targetHint.barrierName} exige mover pelo menos ${targetHint.minimumTroops} tropas.`
                : `A travessia desta barreira exige mover pelo menos ${targetHint.minimumTroops} tropas.`,
            );
          }
          return;
        }

        const traversal = maneuverTraversalFromTarget(targetHint);
        if (!traversal) return;

        dispatch({
          type: "open-maneuver",
          scopeKey,
          sourceId: state.sourceId,
          targetId: territoryId,
          traversal,
        });
      }
    },
    [
      clearSelection,
      game,
      mapHints.targets,
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
    message,
    mapHints,
    arrow,
    selectedTerritoryId,
    onTerritoryClick,
    clearSelection,
    clearDialog,
  };
}

export type GameInteractionController = ReturnType<typeof useGameInteraction>;

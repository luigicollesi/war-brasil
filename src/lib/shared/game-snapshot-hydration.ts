import type { GameSnapshot } from "./game-contract";
import { effectiveGameConnections } from "./game-effective-connections";

export type GameSnapshotPayload = Omit<GameSnapshot, "connections"> & {
  connections?: GameSnapshot["connections"];
};

// O transporte carrega somente a topologia base cacheável; snapshots usados
// pela aplicação sempre expõem a topologia efetiva da rodada atual.
export function hydrateGameSnapshot(
  payload: GameSnapshotPayload,
  baseConnections: GameSnapshot["connections"],
): GameSnapshot {
  return {
    ...payload,
    connections: effectiveGameConnections(
      baseConnections,
      payload.room.activeEvent?.resolvedEffects ?? [],
      payload.room.jurassicTunnelDestinationId,
    ),
  };
}

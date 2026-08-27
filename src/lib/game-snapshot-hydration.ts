import type { GameSnapshot } from "./game-contract";
import { effectiveTerritoryConnections } from "./territory-connections";

export type GameSnapshotPayload = Omit<GameSnapshot, "connections"> & {
  connections?: GameSnapshot["connections"];
};

export function hydrateGameSnapshot(
  payload: GameSnapshotPayload,
  baseConnections: GameSnapshot["connections"],
): GameSnapshot {
  return {
    ...payload,
    connections: effectiveTerritoryConnections(
      baseConnections,
      payload.room.jurassicTunnelDestinationId,
    ),
  };
}

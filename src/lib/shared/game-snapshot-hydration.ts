import type { GameSnapshot } from "./game-contract";
import { effectiveGameConnections } from "./game-effective-connections";

export type GameSnapshotPayload = Omit<GameSnapshot, "connections"> & {
  connections?: GameSnapshot["connections"];
};

// O transporte carrega somente a topologia base cacheável; snapshots usados
// pela aplicação sempre expõem a topologia efetiva da rodada atual. Enquanto a
// UI de negociação ainda não foi entregue, `trade` é apresentado como `cards`
// para manter o fluxo atual jogável sem alterar o estado autoritativo do backend.
export function hydrateGameSnapshot(
  payload: GameSnapshotPayload,
  baseConnections: GameSnapshot["connections"],
): GameSnapshot {
  return {
    ...payload,
    room: {
      ...payload.room,
      phase: payload.room.phase === "trade" ? "cards" : payload.room.phase,
    },
    connections: effectiveGameConnections(
      baseConnections,
      payload.room.activeEvent?.resolvedEffects ?? [],
      payload.room.jurassicTunnelDestinationId,
    ),
  };
}

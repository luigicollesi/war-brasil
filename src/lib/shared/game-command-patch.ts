import type { GamePhase, GameSnapshot, GameStatus } from "./game-contract";

export type GameCommandPatch = {
  room?: {
    status?: GameStatus;
    phase?: GamePhase;
    reinforcementsRemaining?: number;
    winnerPlayerId?: string | null;
  };
  territories?: Array<{
    territoryId: number;
    troops: number;
    movedInTurn?: number;
  }>;
};

export type ApplicableGameCommandResult = {
  baseRevision: number | null;
  revision: number | null;
  patch?: GameCommandPatch;
};

export function applyGameCommandPatch(
  snapshot: GameSnapshot,
  patch: GameCommandPatch,
): GameSnapshot | null {
  let room = snapshot.room;
  let territories = snapshot.territories;

  if (patch.room) {
    room = {
      ...room,
      ...patch.room,
    };
  }

  if (patch.territories?.length) {
    const updates = new Map(
      patch.territories.map((territory) => [territory.territoryId, territory]),
    );
    let matched = 0;

    territories = snapshot.territories.map((territory) => {
      const update = updates.get(territory.territoryId);
      if (!update) return territory;
      matched += 1;
      return {
        ...territory,
        troops: update.troops,
        movedInTurn: update.movedInTurn ?? territory.movedInTurn,
      };
    });

    if (matched !== updates.size) return null;
  }

  if (room === snapshot.room && territories === snapshot.territories) {
    return snapshot;
  }

  return {
    ...snapshot,
    room,
    territories,
  };
}

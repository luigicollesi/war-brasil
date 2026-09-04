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

const GAME_STATUSES = new Set<GameStatus>([
  "waiting",
  "order_roll",
  "playing",
  "finished",
]);
const GAME_PHASES = new Set<GamePhase>([
  "cards",
  "reinforcement",
  "attack",
  "maneuver",
  "end_turn",
  "finished",
]);
const PATCH_KEYS = new Set(["room", "territories"]);
const ROOM_PATCH_KEYS = new Set([
  "status",
  "phase",
  "reinforcementsRemaining",
  "winnerPlayerId",
]);
const TERRITORY_PATCH_KEYS = new Set([
  "territoryId",
  "troops",
  "movedInTurn",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function validRoomPatch(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOM_PATCH_KEYS)) return false;
  if (
    value.status !== undefined &&
    (typeof value.status !== "string" ||
      !GAME_STATUSES.has(value.status as GameStatus))
  ) {
    return false;
  }
  if (
    value.phase !== undefined &&
    (typeof value.phase !== "string" || !GAME_PHASES.has(value.phase as GamePhase))
  ) {
    return false;
  }
  if (
    value.reinforcementsRemaining !== undefined &&
    (typeof value.reinforcementsRemaining !== "number" ||
      !Number.isSafeInteger(value.reinforcementsRemaining) ||
      value.reinforcementsRemaining < 0)
  ) {
    return false;
  }
  if (
    value.winnerPlayerId !== undefined &&
    value.winnerPlayerId !== null &&
    (typeof value.winnerPlayerId !== "string" || value.winnerPlayerId.length < 1)
  ) {
    return false;
  }
  return Object.keys(value).length > 0;
}

function validTerritoryPatch(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, TERRITORY_PATCH_KEYS)) return false;
  if (
    typeof value.territoryId !== "number" ||
    !Number.isSafeInteger(value.territoryId) ||
    value.territoryId < 1 ||
    value.territoryId > 42 ||
    typeof value.troops !== "number" ||
    !Number.isSafeInteger(value.troops) ||
    value.troops < 1
  ) {
    return false;
  }
  if (
    value.movedInTurn !== undefined &&
    (typeof value.movedInTurn !== "number" ||
      !Number.isSafeInteger(value.movedInTurn) ||
      value.movedInTurn < 0)
  ) {
    return false;
  }
  return true;
}

export function isGameCommandPatch(value: unknown): value is GameCommandPatch {
  if (!isRecord(value) || !hasOnlyKeys(value, PATCH_KEYS)) return false;

  const hasRoom = value.room !== undefined;
  const hasTerritories = value.territories !== undefined;
  if (!hasRoom && !hasTerritories) return false;
  if (hasRoom && !validRoomPatch(value.room)) return false;

  if (hasTerritories) {
    if (!Array.isArray(value.territories) || value.territories.length > 42) {
      return false;
    }
    const ids = new Set<number>();
    for (const territory of value.territories) {
      if (!validTerritoryPatch(territory)) return false;
      const territoryId = territory.territoryId;
      if (ids.has(territoryId)) return false;
      ids.add(territoryId);
    }
  }

  return true;
}

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

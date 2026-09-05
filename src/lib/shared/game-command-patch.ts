import type {
  BattleStage,
  GameBattle,
  GamePhase,
  GameSnapshot,
  GameStatus,
  GameTradeOffer,
  GameTradePublicState,
  GameTradeTerms,
} from "./game-contract";
import { isTradeCardDescriptor } from "./game-trade-rules";
import { isPlayerColor, type PlayerColor } from "./lobby";

export type GameCommandPatch = {
  room?: {
    status?: GameStatus;
    phase?: GamePhase;
    currentPlayerId?: string | null;
    turnNumber?: number;
    roundNumber?: number;
    jurassicTunnelDestinationId?: number | null;
    reinforcementsRemaining?: number;
    winnerPlayerId?: string | null;
    automaticAdvancePending?: boolean;
    pendingConquest?: GameSnapshot["room"]["pendingConquest"];
    battle?: GameBattle | null;
  };
  territories?: Array<{
    territoryId: number;
    ownerPlayerId?: string;
    ownerColor?: PlayerColor;
    troops?: number;
    movedInTurn?: number;
  }>;
  trade?: GameTradePublicState | null;
};

export type ApplicableGameCommandResult = {
  baseRevision: number | null;
  revision: number | null;
  patch?: GameCommandPatch;
  privatePatch?: import("./game-private-patch").GamePrivatePatch;
};

const GAME_STATUSES = new Set<GameStatus>([
  "waiting",
  "order_roll",
  "playing",
  "finished",
]);
const GAME_PHASES = new Set<GamePhase>([
  "cards",
  "trade",
  "reinforcement",
  "attack",
  "maneuver",
  "end_turn",
  "finished",
]);
const BATTLE_STAGES = new Set<BattleStage>([
  "awaiting_attacker_roll",
  "show_attacker_result",
  "awaiting_defender_roll",
  "show_defender_result",
  "show_comparison",
  "show_battle_result",
]);
const PATCH_KEYS = new Set(["room", "territories", "trade"]);
const ROOM_PATCH_KEYS = new Set([
  "status",
  "phase",
  "currentPlayerId",
  "turnNumber",
  "roundNumber",
  "jurassicTunnelDestinationId",
  "reinforcementsRemaining",
  "winnerPlayerId",
  "automaticAdvancePending",
  "pendingConquest",
  "battle",
]);
const TERRITORY_PATCH_KEYS = new Set([
  "territoryId",
  "ownerPlayerId",
  "ownerColor",
  "troops",
  "movedInTurn",
]);
const TRADE_PATCH_KEYS = new Set(["offersUsed", "offerLimit", "activeOffer"]);
const OFFER_KEYS = new Set([
  "id",
  "proposerPlayerId",
  "targetPlayerId",
  "status",
  "original",
  "counter",
]);
const TERMS_KEYS = new Set(["offered", "requested"]);
const COUNTER_KEYS = new Set(["proposerPlayerId", "terms"]);
const PENDING_CONQUEST_KEYS = new Set(["fromTerritoryId", "toTerritoryId"]);
const BATTLE_KEYS = new Set([
  "attacker",
  "defender",
  "attackerLosses",
  "defenderLosses",
  "conquered",
  "attackerTerritoryId",
  "defenderTerritoryId",
  "attackerPlayerId",
  "defenderPlayerId",
  "stage",
  "stageStartedAt",
  "attackMode",
  "barrierName",
  "attackerTroopsAfter",
  "defenderTroopsAfter",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function validNumericPlayerId(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function validNullablePlayerId(value: unknown) {
  return value === null || validNumericPlayerId(value);
}

function validNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function validTerritoryId(value: unknown) {
  return validPositiveInteger(value) && Number(value) <= 42;
}

function validTradeTerms(value: unknown): value is GameTradeTerms {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, TERMS_KEYS) &&
    isTradeCardDescriptor(value.offered) &&
    isTradeCardDescriptor(value.requested)
  );
}

function validTradeOffer(value: unknown): value is GameTradeOffer {
  if (!isRecord(value) || !hasOnlyKeys(value, OFFER_KEYS)) return false;
  if (
    typeof value.id !== "string" ||
    !/^\d+$/.test(value.id) ||
    !validNumericPlayerId(value.proposerPlayerId) ||
    !validNumericPlayerId(value.targetPlayerId) ||
    !new Set(["open", "countered", "accepted_pending_selection"]).has(
      value.status as string,
    ) ||
    !validTradeTerms(value.original)
  ) {
    return false;
  }

  if (value.counter === null) return true;
  return (
    isRecord(value.counter) &&
    hasOnlyKeys(value.counter, COUNTER_KEYS) &&
    validNumericPlayerId(value.counter.proposerPlayerId) &&
    validTradeTerms(value.counter.terms)
  );
}

function validTradePublicState(value: unknown): value is GameTradePublicState {
  if (!isRecord(value) || !hasOnlyKeys(value, TRADE_PATCH_KEYS)) return false;
  if (
    !validNonNegativeInteger(value.offersUsed) ||
    !validPositiveInteger(value.offerLimit) ||
    Number(value.offersUsed) > Number(value.offerLimit)
  ) {
    return false;
  }
  return value.activeOffer === null || validTradeOffer(value.activeOffer);
}

function validDice(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    value.every(
      (die) =>
        typeof die === "number" &&
        Number.isSafeInteger(die) &&
        die >= 1 &&
        die <= 6,
    )
  );
}

function validBattle(value: unknown): value is GameBattle {
  if (!isRecord(value) || !hasOnlyKeys(value, BATTLE_KEYS)) return false;
  if (
    !validDice(value.attacker) ||
    !validDice(value.defender) ||
    !validNonNegativeInteger(value.attackerLosses) ||
    !validNonNegativeInteger(value.defenderLosses) ||
    typeof value.conquered !== "boolean" ||
    !validTerritoryId(value.attackerTerritoryId) ||
    !validTerritoryId(value.defenderTerritoryId) ||
    !validNumericPlayerId(value.attackerPlayerId) ||
    !validNumericPlayerId(value.defenderPlayerId) ||
    typeof value.stage !== "string" ||
    !BATTLE_STAGES.has(value.stage as BattleStage) ||
    typeof value.stageStartedAt !== "string" ||
    value.stageStartedAt.length < 1
  ) {
    return false;
  }
  if (
    value.attackMode !== undefined &&
    value.attackMode !== "normal" &&
    value.attackMode !== "barrier"
  ) {
    return false;
  }
  if (
    value.barrierName !== undefined &&
    value.barrierName !== null &&
    typeof value.barrierName !== "string"
  ) {
    return false;
  }
  if (
    value.attackerTroopsAfter !== undefined &&
    !validNonNegativeInteger(value.attackerTroopsAfter)
  ) {
    return false;
  }
  if (
    value.defenderTroopsAfter !== undefined &&
    !validNonNegativeInteger(value.defenderTroopsAfter)
  ) {
    return false;
  }
  return true;
}

function validPendingConquest(value: unknown) {
  return (
    value === null ||
    (isRecord(value) &&
      hasOnlyKeys(value, PENDING_CONQUEST_KEYS) &&
      validTerritoryId(value.fromTerritoryId) &&
      validTerritoryId(value.toTerritoryId))
  );
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
    value.currentPlayerId !== undefined &&
    !validNullablePlayerId(value.currentPlayerId)
  ) {
    return false;
  }
  if (value.turnNumber !== undefined && !validPositiveInteger(value.turnNumber)) {
    return false;
  }
  if (value.roundNumber !== undefined && !validPositiveInteger(value.roundNumber)) {
    return false;
  }
  if (
    value.jurassicTunnelDestinationId !== undefined &&
    value.jurassicTunnelDestinationId !== null &&
    !validTerritoryId(value.jurassicTunnelDestinationId)
  ) {
    return false;
  }
  if (
    value.reinforcementsRemaining !== undefined &&
    !validNonNegativeInteger(value.reinforcementsRemaining)
  ) {
    return false;
  }
  if (
    value.winnerPlayerId !== undefined &&
    !validNullablePlayerId(value.winnerPlayerId)
  ) {
    return false;
  }
  if (
    value.automaticAdvancePending !== undefined &&
    typeof value.automaticAdvancePending !== "boolean"
  ) {
    return false;
  }
  if (
    value.pendingConquest !== undefined &&
    !validPendingConquest(value.pendingConquest)
  ) {
    return false;
  }
  if (
    value.battle !== undefined &&
    value.battle !== null &&
    !validBattle(value.battle)
  ) {
    return false;
  }
  return Object.keys(value).length > 0;
}

function validTerritoryPatch(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, TERRITORY_PATCH_KEYS)) return false;
  if (!validTerritoryId(value.territoryId)) return false;

  const hasUpdate =
    value.ownerPlayerId !== undefined ||
    value.ownerColor !== undefined ||
    value.troops !== undefined ||
    value.movedInTurn !== undefined;
  if (!hasUpdate) return false;

  if (
    value.ownerPlayerId !== undefined &&
    !validNumericPlayerId(value.ownerPlayerId)
  ) {
    return false;
  }
  if (value.ownerColor !== undefined && !isPlayerColor(value.ownerColor)) {
    return false;
  }
  if (value.troops !== undefined && !validPositiveInteger(value.troops)) {
    return false;
  }
  if (
    value.movedInTurn !== undefined &&
    !validNonNegativeInteger(value.movedInTurn)
  ) {
    return false;
  }
  return true;
}

export function isGameCommandPatch(value: unknown): value is GameCommandPatch {
  if (!isRecord(value) || !hasOnlyKeys(value, PATCH_KEYS)) return false;

  const hasRoom = value.room !== undefined;
  const hasTerritories = value.territories !== undefined;
  const hasTrade = value.trade !== undefined;
  if (!hasRoom && !hasTerritories && !hasTrade) return false;
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

  if (hasTrade && value.trade !== null && !validTradePublicState(value.trade)) {
    return false;
  }

  return true;
}

export function applyGameCommandPatch(
  snapshot: GameSnapshot,
  patch: GameCommandPatch,
): GameSnapshot | null {
  let room = snapshot.room;
  let territories = snapshot.territories;
  let trade = snapshot.trade;

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
        ...(update.ownerPlayerId !== undefined
          ? { ownerPlayerId: update.ownerPlayerId }
          : {}),
        ...(update.ownerColor !== undefined
          ? { ownerColor: update.ownerColor }
          : {}),
        ...(update.troops !== undefined ? { troops: update.troops } : {}),
        ...(update.movedInTurn !== undefined
          ? { movedInTurn: update.movedInTurn }
          : {}),
      };
    });

    if (matched !== updates.size) return null;
  }

  if (patch.trade !== undefined) {
    if (patch.trade === null) {
      trade = null;
    } else {
      if (!snapshot.trade) return null;
      trade = {
        ...snapshot.trade,
        ...patch.trade,
      };
    }
  }

  if (
    room === snapshot.room &&
    territories === snapshot.territories &&
    trade === snapshot.trade
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    room,
    territories,
    trade,
  };
}

import type {
  GameBattle,
  GameCard,
  GamePlayer,
  GameSnapshot,
  GameTerritory,
} from "@/src/lib/game-contract";
import type { TerritoryConnection } from "@/src/lib/territory-connections";

function sameArray<T>(
  left: readonly T[],
  right: readonly T[],
  equal: (a: T, b: T) => boolean,
) {
  return (
    left.length === right.length &&
    left.every((value, index) => equal(value, right[index]))
  );
}

function sameNumbers(left: readonly number[], right: readonly number[]) {
  return sameArray(left, right, (a, b) => a === b);
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return sameArray(left, right, (a, b) => a === b);
}

function sameBattle(left: GameBattle | null, right: GameBattle | null) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.attackerLosses === right.attackerLosses &&
    left.defenderLosses === right.defenderLosses &&
    left.conquered === right.conquered &&
    left.attackerTerritoryId === right.attackerTerritoryId &&
    left.defenderTerritoryId === right.defenderTerritoryId &&
    left.attackerPlayerId === right.attackerPlayerId &&
    left.defenderPlayerId === right.defenderPlayerId &&
    left.stage === right.stage &&
    left.stageStartedAt === right.stageStartedAt &&
    left.attackerTroopsAfter === right.attackerTroopsAfter &&
    left.defenderTroopsAfter === right.defenderTroopsAfter &&
    sameNumbers(left.attacker, right.attacker) &&
    sameNumbers(left.defender, right.defender)
  );
}

function samePlayer(left: GamePlayer, right: GamePlayer) {
  return (
    left.id === right.id &&
    left.factionName === right.factionName &&
    left.color === right.color &&
    left.turnPosition === right.turnPosition &&
    left.isMe === right.isMe &&
    sameArray(
      left.rolls,
      right.rolls,
      (a, b) => a.round === b.round && a.value === b.value,
    )
  );
}

function sameTerritory(left: GameTerritory, right: GameTerritory) {
  return (
    left.territoryId === right.territoryId &&
    left.ownerPlayerId === right.ownerPlayerId &&
    left.ownerColor === right.ownerColor &&
    left.troops === right.troops &&
    left.movedInTurn === right.movedInTurn
  );
}

function sameCard(left: GameCard, right: GameCard) {
  return (
    left.id === right.id &&
    left.territoryId === right.territoryId &&
    left.symbol === right.symbol
  );
}

function sameConnection(left: TerritoryConnection, right: TerritoryConnection) {
  return (
    left.territoryA === right.territoryA &&
    left.territoryB === right.territoryB &&
    left.exists === right.exists &&
    left.passable === right.passable &&
    left.barrierName === right.barrierName &&
    left.description === right.description
  );
}

function sameObjective(
  left: GameSnapshot["myObjective"],
  right: GameSnapshot["myObjective"],
) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.description === right.description &&
    left.targetFactionName === right.targetFactionName
  );
}

function sameRoom(left: GameSnapshot["room"], right: GameSnapshot["room"]) {
  const leftPending = left.pendingConquest;
  const rightPending = right.pendingConquest;
  const pendingEqual =
    leftPending === rightPending ||
    (Boolean(leftPending) &&
      Boolean(rightPending) &&
      leftPending!.fromTerritoryId === rightPending!.fromTerritoryId &&
      leftPending!.toTerritoryId === rightPending!.toTerritoryId);

  return (
    left.id === right.id &&
    left.code === right.code &&
    left.status === right.status &&
    left.orderRollRound === right.orderRollRound &&
    left.orderRollPlayerId === right.orderRollPlayerId &&
    left.lastOrderRollPlayerId === right.lastOrderRollPlayerId &&
    left.phase === right.phase &&
    left.currentPlayerId === right.currentPlayerId &&
    left.turnNumber === right.turnNumber &&
    left.roundNumber === right.roundNumber &&
    left.jurassicTunnelDestinationId === right.jurassicTunnelDestinationId &&
    left.reinforcementsRemaining === right.reinforcementsRemaining &&
    left.winnerPlayerId === right.winnerPlayerId &&
    pendingEqual &&
    sameBattle(left.battle, right.battle)
  );
}

export function shareGameSnapshot(
  previous: GameSnapshot | null,
  next: GameSnapshot,
): GameSnapshot {
  if (!previous) return next;

  const room = sameRoom(previous.room, next.room) ? previous.room : next.room;
  const players = sameArray(previous.players, next.players, samePlayer)
    ? previous.players
    : next.players;
  const territories = sameArray(
    previous.territories,
    next.territories,
    sameTerritory,
  )
    ? previous.territories
    : next.territories;
  const eligiblePlayerIds = sameStrings(
    previous.eligiblePlayerIds,
    next.eligiblePlayerIds,
  )
    ? previous.eligiblePlayerIds
    : next.eligiblePlayerIds;
  const connections = sameArray(
    previous.connections,
    next.connections,
    sameConnection,
  )
    ? previous.connections
    : next.connections;
  const myCards = sameArray(previous.myCards, next.myCards, sameCard)
    ? previous.myCards
    : next.myCards;
  const myObjective = sameObjective(previous.myObjective, next.myObjective)
    ? previous.myObjective
    : next.myObjective;

  if (
    room === previous.room &&
    players === previous.players &&
    territories === previous.territories &&
    eligiblePlayerIds === previous.eligiblePlayerIds &&
    connections === previous.connections &&
    myCards === previous.myCards &&
    myObjective === previous.myObjective
  ) {
    return previous;
  }

  return {
    room,
    players,
    territories,
    eligiblePlayerIds,
    connections,
    myCards,
    myObjective,
  };
}

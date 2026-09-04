import type {
  GameBattle,
  GameCard,
  GamePlayer,
  GameSnapshot,
  GameTerritory,
} from "./game-contract";
import type { TradeCardDescriptor } from "./game-trade-rules";
import type {
  AppliedEventTroopChange,
  ResolvedBarrierMove,
  ResolvedEventEffect,
  TerritoryConnectionPair,
} from "./events/event-types";
import type { TerritoryConnection } from "./territory-connections";

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

function samePair(left: TerritoryConnectionPair, right: TerritoryConnectionPair) {
  return left[0] === right[0] && left[1] === right[1];
}

function sameBarrierMove(left: ResolvedBarrierMove, right: ResolvedBarrierMove) {
  return (
    left.anchorTerritoryId === right.anchorTerritoryId &&
    samePair(left.from, right.from) &&
    samePair(left.to, right.to) &&
    left.barrierName === right.barrierName &&
    left.description === right.description
  );
}

function sameResolvedEventEffect(
  left: ResolvedEventEffect,
  right: ResolvedEventEffect,
) {
  if (left.type !== right.type) return false;

  switch (left.type) {
    case "ADD_TROOPS":
      return (
        right.type === "ADD_TROOPS" &&
        left.amount === right.amount &&
        sameNumbers(left.territories, right.territories)
      );
    case "REMOVE_TROOPS":
      return (
        right.type === "REMOVE_TROOPS" &&
        left.amount === right.amount &&
        sameNumbers(left.territories, right.territories)
      );
    case "BLOCK_ATTACK":
      return (
        right.type === "BLOCK_ATTACK" &&
        sameNumbers(left.territories, right.territories)
      );
    case "OPEN_CONNECTIONS":
      return (
        right.type === "OPEN_CONNECTIONS" &&
        sameArray(left.connections, right.connections, samePair)
      );
    case "BLOCK_CONNECTIONS":
      return (
        right.type === "BLOCK_CONNECTIONS" &&
        sameArray(left.connections, right.connections, samePair)
      );
    case "RANDOM_OPEN_CONNECTIONS":
      return (
        right.type === "RANDOM_OPEN_CONNECTIONS" &&
        sameArray(left.connections, right.connections, samePair)
      );
    case "RANDOM_BLOCK_CONNECTIONS":
      return (
        right.type === "RANDOM_BLOCK_CONNECTIONS" &&
        sameArray(left.connections, right.connections, samePair)
      );
    case "RANDOM_TOGGLE_CONNECTIONS":
      return (
        right.type === "RANDOM_TOGGLE_CONNECTIONS" &&
        sameArray(left.moves, right.moves, sameBarrierMove)
      );
  }
}

function sameAppliedTroopChange(
  left: AppliedEventTroopChange,
  right: AppliedEventTroopChange,
) {
  return (
    left.type === right.type &&
    left.territoryId === right.territoryId &&
    left.beforeTroops === right.beforeTroops &&
    left.afterTroops === right.afterTroops &&
    left.delta === right.delta
  );
}

function sameActiveEvent(
  left: GameSnapshot["room"]["activeEvent"],
  right: GameSnapshot["room"]["activeEvent"],
) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.eventId === right.eventId &&
    left.name === right.name &&
    left.description === right.description &&
    sameArray(
      left.resolvedEffects,
      right.resolvedEffects,
      sameResolvedEventEffect,
    ) &&
    sameArray(
      left.appliedTroopChanges,
      right.appliedTroopChanges,
      sameAppliedTroopChange,
    )
  );
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
    left.attackMode === right.attackMode &&
    left.barrierName === right.barrierName &&
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
    left.isBot === right.isBot &&
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

function sameRematch(
  left: GameSnapshot["room"]["rematch"],
  right: GameSnapshot["room"]["rematch"],
) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.voteCount === right.voteCount &&
    left.requiredCount === right.requiredCount &&
    left.hasVoted === right.hasVoted
  );
}

function sameTradeDescriptor(
  left: TradeCardDescriptor,
  right: TradeCardDescriptor,
) {
  if (left.kind !== right.kind) return false;
  if (left.kind === "territory" && right.kind === "territory") {
    return left.territoryId === right.territoryId;
  }
  if (left.kind === "symbol" && right.kind === "symbol") {
    return left.symbol === right.symbol;
  }
  return left.kind === "wild" && right.kind === "wild";
}

function sameTradeTerms(
  left: GameSnapshot["trade"] extends infer T
    ? T extends { activeOffer: infer O }
      ? O extends { original: infer Terms }
        ? Terms
        : never
      : never
    : never,
  right: GameSnapshot["trade"] extends infer T
    ? T extends { activeOffer: infer O }
      ? O extends { original: infer Terms }
        ? Terms
        : never
      : never
    : never,
) {
  return (
    sameTradeDescriptor(left.offered, right.offered) &&
    sameTradeDescriptor(left.requested, right.requested)
  );
}

function sameTrade(
  left: GameSnapshot["trade"],
  right: GameSnapshot["trade"],
) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.offersUsed !== right.offersUsed ||
    left.offerLimit !== right.offerLimit ||
    left.signalsUsed !== right.signalsUsed ||
    left.signalLimit !== right.signalLimit
  ) {
    return false;
  }

  const leftPending = left.myPendingSelection;
  const rightPending = right.myPendingSelection;
  const pendingEqual =
    leftPending === rightPending ||
    Boolean(
      leftPending &&
        rightPending &&
        leftPending.offerId === rightPending.offerId &&
        sameTradeDescriptor(leftPending.descriptor, rightPending.descriptor),
    );
  if (!pendingEqual) return false;

  const leftOffer = left.activeOffer;
  const rightOffer = right.activeOffer;
  if (leftOffer === rightOffer) return true;
  if (!leftOffer || !rightOffer) return false;
  if (
    leftOffer.id !== rightOffer.id ||
    leftOffer.proposerPlayerId !== rightOffer.proposerPlayerId ||
    leftOffer.targetPlayerId !== rightOffer.targetPlayerId ||
    leftOffer.status !== rightOffer.status ||
    !sameTradeTerms(leftOffer.original, rightOffer.original)
  ) {
    return false;
  }

  const leftCounter = leftOffer.counter;
  const rightCounter = rightOffer.counter;
  if (leftCounter === rightCounter) return true;
  return Boolean(
    leftCounter &&
      rightCounter &&
      leftCounter.proposerPlayerId === rightCounter.proposerPlayerId &&
      sameTradeTerms(leftCounter.terms, rightCounter.terms),
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
    sameActiveEvent(left.activeEvent, right.activeEvent) &&
    left.reinforcementsRemaining === right.reinforcementsRemaining &&
    left.winnerPlayerId === right.winnerPlayerId &&
    sameRematch(left.rematch, right.rematch) &&
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
  const trade = sameTrade(previous.trade, next.trade) ? previous.trade : next.trade;
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
    trade === previous.trade &&
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
    trade,
    myObjective,
  };
}

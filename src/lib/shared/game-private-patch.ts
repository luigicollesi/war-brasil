import type {
  GameCard,
  GameSnapshot,
  GameTradePrivateState,
} from "./game-contract";
import { isTradeCardDescriptor } from "./game-trade-rules";

export type GamePrivatePatch = {
  myCards?: GameCard[];
  trade?: GameTradePrivateState;
};

const PRIVATE_PATCH_KEYS = new Set(["myCards", "trade"]);
const PRIVATE_TRADE_KEYS = new Set([
  "signalsUsed",
  "signalLimit",
  "myPendingSelection",
]);
const PENDING_SELECTION_KEYS = new Set(["offerId", "descriptor"]);
const CARD_KEYS = new Set(["id", "territoryId", "symbol"]);
const CARD_SYMBOLS = new Set(["leaf", "gold", "water", "wild"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function validCard(value: unknown): value is GameCard {
  if (!isRecord(value) || !hasOnlyKeys(value, CARD_KEYS)) return false;
  if (typeof value.id !== "string" || !/^\d+$/.test(value.id)) return false;
  if (
    value.territoryId !== null &&
    (typeof value.territoryId !== "number" ||
      !Number.isSafeInteger(value.territoryId) ||
      value.territoryId < 1 ||
      value.territoryId > 42)
  ) {
    return false;
  }
  return typeof value.symbol === "string" && CARD_SYMBOLS.has(value.symbol);
}

function validPrivateTrade(value: unknown): value is GameTradePrivateState {
  if (!isRecord(value) || !hasOnlyKeys(value, PRIVATE_TRADE_KEYS)) return false;
  if (
    typeof value.signalsUsed !== "number" ||
    !Number.isSafeInteger(value.signalsUsed) ||
    value.signalsUsed < 0 ||
    typeof value.signalLimit !== "number" ||
    !Number.isSafeInteger(value.signalLimit) ||
    value.signalLimit < 1 ||
    value.signalsUsed > value.signalLimit
  ) {
    return false;
  }

  if (value.myPendingSelection === null) return true;
  return (
    isRecord(value.myPendingSelection) &&
    hasOnlyKeys(value.myPendingSelection, PENDING_SELECTION_KEYS) &&
    typeof value.myPendingSelection.offerId === "string" &&
    /^\d+$/.test(value.myPendingSelection.offerId) &&
    isTradeCardDescriptor(value.myPendingSelection.descriptor)
  );
}

export function isGamePrivatePatch(value: unknown): value is GamePrivatePatch {
  if (!isRecord(value) || !hasOnlyKeys(value, PRIVATE_PATCH_KEYS)) return false;
  const hasCards = value.myCards !== undefined;
  const hasTrade = value.trade !== undefined;
  if (!hasCards && !hasTrade) return false;

  if (hasCards) {
    if (!Array.isArray(value.myCards) || value.myCards.length > 128) return false;
    const ids = new Set<string>();
    for (const card of value.myCards) {
      if (!validCard(card) || ids.has(card.id)) return false;
      ids.add(card.id);
    }
  }

  return !hasTrade || validPrivateTrade(value.trade);
}

export function applyGamePrivatePatch(
  snapshot: GameSnapshot,
  patch: GamePrivatePatch,
): GameSnapshot | null {
  let myCards = snapshot.myCards;
  let trade = snapshot.trade;

  if (patch.myCards) {
    myCards = patch.myCards;
  }

  if (patch.trade) {
    if (!trade) return null;
    trade = {
      ...trade,
      ...patch.trade,
    };
  }

  if (myCards === snapshot.myCards && trade === snapshot.trade) {
    return snapshot;
  }

  return {
    ...snapshot,
    myCards,
    trade,
  };
}

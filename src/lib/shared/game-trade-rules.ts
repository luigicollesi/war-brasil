import type { CardSymbol } from "./game-config";

export const PLAYER_TRADE_OFFER_LIMIT = 3;
export const PLAYER_TRADE_SIGNAL_LIMIT = 2;

export type TradeCardDescriptor =
  | { kind: "territory"; territoryId: number }
  | { kind: "symbol"; symbol: CardSymbol }
  | { kind: "wild" };

export function isTradeCardDescriptor(
  value: unknown,
): value is TradeCardDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  if (record.kind === "wild") {
    return Object.keys(record).every((key) => key === "kind");
  }

  if (record.kind === "territory") {
    return (
      Object.keys(record).every((key) => key === "kind" || key === "territoryId") &&
      typeof record.territoryId === "number" &&
      Number.isSafeInteger(record.territoryId) &&
      record.territoryId >= 1 &&
      record.territoryId <= 42
    );
  }

  if (record.kind === "symbol") {
    return (
      Object.keys(record).every((key) => key === "kind" || key === "symbol") &&
      (record.symbol === "leaf" ||
        record.symbol === "gold" ||
        record.symbol === "water")
    );
  }

  return false;
}

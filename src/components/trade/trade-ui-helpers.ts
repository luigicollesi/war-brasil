import type { GamePlayer, GameSnapshot } from "@/src/lib/shared/game-contract";
import { TERRITORY_METADATA, type CardSymbol } from "@/src/lib/shared/game-config";
import type { TradeCardDescriptor } from "@/src/lib/shared/game-trade-rules";
import { PLAYER_COLORS } from "@/src/lib/shared/lobby";

export const TRADE_SYMBOLS: Array<{ symbol: CardSymbol; label: string }> = [
  { symbol: "leaf", label: "Folha" },
  { symbol: "gold", label: "Ouro" },
  { symbol: "water", label: "Água" },
];

export function tradePlayerColor(player: GamePlayer) {
  return PLAYER_COLORS.find((color) => color.value === player.color)?.hex ?? "#17372d";
}

export function tradePlayerName(snapshot: GameSnapshot, playerId: string) {
  return snapshot.players.find((player) => player.id === playerId)?.factionName ?? "Jogador";
}

export function tradeDescriptorLabel(descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return "Coringa";
  if (descriptor.kind === "symbol") {
    return (
      TRADE_SYMBOLS.find((item) => item.symbol === descriptor.symbol)?.label ??
      descriptor.symbol
    );
  }
  return (
    TERRITORY_METADATA[descriptor.territoryId]?.name ??
    `Território ${descriptor.territoryId}`
  );
}

export function tradeDescriptorKey(descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return "wild";
  if (descriptor.kind === "symbol") return `symbol:${descriptor.symbol}`;
  return `territory:${descriptor.territoryId}`;
}

export function sameTradeDescriptor(
  left: TradeCardDescriptor | null,
  right: TradeCardDescriptor,
) {
  return Boolean(left && tradeDescriptorKey(left) === tradeDescriptorKey(right));
}

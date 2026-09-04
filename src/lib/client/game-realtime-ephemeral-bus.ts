"use client";

import type { GameTradeSignalEvent } from "../shared/game-realtime-contract";

type TradeSignalListener = (event: GameTradeSignalEvent) => void;

const tradeSignalListeners = new Map<string, Set<TradeSignalListener>>();

export function dispatchTradeSignal(
  roomId: string,
  event: GameTradeSignalEvent,
) {
  for (const listener of tradeSignalListeners.get(roomId) ?? []) {
    listener(event);
  }
}

export function subscribeTradeSignal(
  roomId: string,
  listener: TradeSignalListener,
) {
  const listeners = tradeSignalListeners.get(roomId) ?? new Set<TradeSignalListener>();
  listeners.add(listener);
  tradeSignalListeners.set(roomId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) tradeSignalListeners.delete(roomId);
  };
}

"use client";

import type {
  GameTradeResolutionEvent,
  GameTradeSignalEvent,
} from "../shared/game-realtime-contract";

type TradeSignalListener = (event: GameTradeSignalEvent) => void;
type TradeResolutionListener = (event: GameTradeResolutionEvent) => void;

const tradeSignalListeners = new Map<string, Set<TradeSignalListener>>();
const tradeResolutionListeners = new Map<string, Set<TradeResolutionListener>>();

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

export function dispatchTradeResolution(
  roomId: string,
  event: GameTradeResolutionEvent,
) {
  for (const listener of tradeResolutionListeners.get(roomId) ?? []) {
    listener(event);
  }
}

export function subscribeTradeResolution(
  roomId: string,
  listener: TradeResolutionListener,
) {
  const listeners =
    tradeResolutionListeners.get(roomId) ?? new Set<TradeResolutionListener>();
  listeners.add(listener);
  tradeResolutionListeners.set(roomId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) tradeResolutionListeners.delete(roomId);
  };
}

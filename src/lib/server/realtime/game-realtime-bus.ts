import "server-only";

import type { PoolClient } from "pg";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type { GamePrivatePatch } from "@/src/lib/game-private-patch";
import type { TradeCardDescriptor } from "@/src/lib/game-trade-rules";

export type GameRealtimeRoomInvalidationEvent = {
  kind: "invalidate";
  scope: "room";
  roomId: string;
  revision: number;
};

export type GameRealtimePlayerInvalidationEvent = {
  kind: "invalidate";
  scope: "player";
  roomId: string;
  playerId: string;
  revision: number;
};

export type GameRealtimePatchEvent = {
  kind: "patch";
  scope: "room";
  roomId: string;
  baseRevision: number;
  revision: number;
  patch: GameCommandPatch;
};

export type GameRealtimePrivatePatchEvent = {
  kind: "private_patch";
  scope: "player";
  roomId: string;
  playerId: string;
  baseRevision: number;
  revision: number;
  patch: GamePrivatePatch;
};

export type GameRealtimeTradeSignalEvent = {
  kind: "ephemeral";
  scope: "room";
  roomId: string;
  eventId: string;
  eventType: "trade.signal";
  payload: {
    playerId: string;
    turnNumber: number;
    card: TradeCardDescriptor;
  };
};

export type GameRealtimeTradeResolutionEvent = {
  kind: "ephemeral";
  scope: "room";
  roomId: string;
  eventId: string;
  eventType: "trade.resolution";
  payload: {
    offerId: string;
    turnNumber: number;
    recipientPlayerId: string;
    actorPlayerId: string;
    outcome: "declined" | "counter_declined";
  };
};

export type GameRealtimeBusEvent =
  | GameRealtimeRoomInvalidationEvent
  | GameRealtimePlayerInvalidationEvent
  | GameRealtimePatchEvent
  | GameRealtimePrivatePatchEvent
  | GameRealtimeTradeSignalEvent
  | GameRealtimeTradeResolutionEvent;

export type GameRealtimeBusPublishContext = {
  postgresClient: PoolClient;
};

export interface GameRealtimeBus {
  publish(
    event: GameRealtimeBusEvent,
    context: GameRealtimeBusPublishContext,
  ): Promise<void>;
}

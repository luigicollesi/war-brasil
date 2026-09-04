import "server-only";

import type { PoolClient } from "pg";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";

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

export type GameRealtimeBusEvent =
  | GameRealtimeRoomInvalidationEvent
  | GameRealtimePlayerInvalidationEvent
  | GameRealtimePatchEvent;

export type GameRealtimeBusPublishContext = {
  postgresClient: PoolClient;
};

export interface GameRealtimeBus {
  publish(
    event: GameRealtimeBusEvent,
    context: GameRealtimeBusPublishContext,
  ): Promise<void>;
}

import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  isGameCommandPatch,
  type GameCommandPatch,
} from "@/src/lib/game-command-patch";
import type { TradeCardDescriptor } from "@/src/lib/game-trade-rules";
import type { GameRealtimeBusEvent } from "./realtime/game-realtime-bus";
import { publishGameRealtimeBusEvent } from "./realtime/game-realtime-bus-runtime";
import { publishGameRealtimeMetric } from "./observability/game-realtime-metrics";

const GAME_REALTIME_NOTIFY_MAX_BYTES = 7_000;

function gameRealtimeEnabled() {
  return process.env.GAME_REALTIME_ENABLED === "true";
}

function gameRealtimePatchesEnabled() {
  return process.env.GAME_REALTIME_PATCHES_ENABLED === "true";
}

function invalidationEvent(
  roomId: string,
  revision: number,
  playerId?: string,
): GameRealtimeBusEvent {
  if (playerId) {
    return {
      kind: "invalidate",
      scope: "player",
      roomId,
      playerId,
      revision,
    };
  }

  return {
    kind: "invalidate",
    scope: "room",
    roomId,
    revision,
  };
}

function patchEvent(
  roomId: string,
  baseRevision: number,
  revision: number,
  patch: GameCommandPatch,
): GameRealtimeBusEvent {
  return {
    kind: "patch",
    scope: "room",
    roomId,
    baseRevision,
    revision,
    patch,
  };
}

async function publishEvent(
  client: PoolClient,
  event: Extract<GameRealtimeBusEvent, { kind: "invalidate" | "patch" }>,
  metricName: "notify.publish" | "notify.private" | "notify.patch",
) {
  try {
    await publishGameRealtimeBusEvent(client, event);
    publishGameRealtimeMetric({
      name: metricName,
      roomId: event.roomId,
      revision: event.revision,
    });
  } catch (error) {
    publishGameRealtimeMetric({
      name: "notify.failure",
      roomId: event.roomId,
      revision: event.revision,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function publishGameInvalidation(
  client: PoolClient,
  roomId: string,
  revision: number,
) {
  if (!gameRealtimeEnabled()) return;
  await publishEvent(
    client,
    invalidationEvent(roomId, revision),
    "notify.publish",
  );
}

export async function publishPlayerGameInvalidation(
  client: PoolClient,
  roomId: string,
  playerId: string,
  revision: number,
) {
  if (!gameRealtimeEnabled()) return;
  if (!/^\d+$/.test(playerId)) return;

  await publishEvent(
    client,
    invalidationEvent(roomId, revision, playerId),
    "notify.private",
  );
}

export async function publishGameTradeSignal(
  client: PoolClient,
  input: {
    roomId: string;
    playerId: string;
    turnNumber: number;
    card: TradeCardDescriptor;
  },
) {
  if (!gameRealtimeEnabled()) return;

  try {
    await publishGameRealtimeBusEvent(client, {
      kind: "ephemeral",
      scope: "room",
      roomId: input.roomId,
      eventId: randomUUID(),
      eventType: "trade.signal",
      payload: {
        playerId: input.playerId,
        turnNumber: input.turnNumber,
        card: input.card,
      },
    });
  } catch {
    // Sinalização é propositalmente best-effort: não gera revision, receipt,
    // retry persistente nem telemetria com o conteúdo revelado da carta.
  }
}

export async function publishGameChange(
  client: PoolClient,
  input: {
    roomId: string;
    baseRevision: number;
    revision: number;
    patch?: GameCommandPatch | null;
  },
) {
  if (!gameRealtimeEnabled()) return;

  if (
    gameRealtimePatchesEnabled() &&
    input.patch &&
    isGameCommandPatch(input.patch)
  ) {
    const event = patchEvent(
      input.roomId,
      input.baseRevision,
      input.revision,
      input.patch,
    );
    const payloadBytes = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (payloadBytes <= GAME_REALTIME_NOTIFY_MAX_BYTES) {
      await publishEvent(client, event, "notify.patch");
      return;
    }

    publishGameRealtimeMetric({
      name: "notify.patch_fallback",
      roomId: input.roomId,
      revision: input.revision,
      payloadBytes,
    });
  }

  await publishGameInvalidation(client, input.roomId, input.revision);
}

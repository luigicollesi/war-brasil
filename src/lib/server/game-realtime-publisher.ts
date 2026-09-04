import "server-only";

import type { PoolClient } from "pg";
import {
  isGameCommandPatch,
  type GameCommandPatch,
} from "@/src/lib/game-command-patch";
import { publishGameRealtimeMetric } from "./observability/game-realtime-metrics";

export const DEFAULT_GAME_REALTIME_CHANNEL = "war_game_revision";
const GAME_REALTIME_NOTIFY_MAX_BYTES = 7_000;

function gameRealtimeEnabled() {
  return process.env.GAME_REALTIME_ENABLED === "true";
}

function gameRealtimePatchesEnabled() {
  return process.env.GAME_REALTIME_PATCHES_ENABLED === "true";
}

function gameRealtimeChannel() {
  const configured = process.env.GAME_REALTIME_CHANNEL?.trim();
  return configured || DEFAULT_GAME_REALTIME_CHANNEL;
}

function invalidationPayload(
  roomId: string,
  revision: number,
  playerId?: string,
) {
  return JSON.stringify({
    kind: "invalidate",
    scope: playerId ? "player" : "room",
    roomId,
    revision,
    ...(playerId ? { playerId } : {}),
  });
}

function patchPayload(
  roomId: string,
  baseRevision: number,
  revision: number,
  patch: GameCommandPatch,
) {
  return JSON.stringify({
    kind: "patch",
    scope: "room",
    roomId,
    baseRevision,
    revision,
    patch,
  });
}

async function publishPayload(
  client: PoolClient,
  roomId: string,
  revision: number,
  payload: string,
  metricName: "notify.publish" | "notify.private" | "notify.patch",
) {
  try {
    await client.query("SELECT pg_notify($1,$2)", [gameRealtimeChannel(), payload]);
    publishGameRealtimeMetric({
      name: metricName,
      roomId,
      revision,
    });
  } catch (error) {
    publishGameRealtimeMetric({
      name: "notify.failure",
      roomId,
      revision,
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
  await publishPayload(
    client,
    roomId,
    revision,
    invalidationPayload(roomId, revision),
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

  await publishPayload(
    client,
    roomId,
    revision,
    invalidationPayload(roomId, revision, playerId),
    "notify.private",
  );
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
    const payload = patchPayload(
      input.roomId,
      input.baseRevision,
      input.revision,
      input.patch,
    );
    if (Buffer.byteLength(payload, "utf8") <= GAME_REALTIME_NOTIFY_MAX_BYTES) {
      await publishPayload(
        client,
        input.roomId,
        input.revision,
        payload,
        "notify.patch",
      );
      return;
    }

    publishGameRealtimeMetric({
      name: "notify.patch_fallback",
      roomId: input.roomId,
      revision: input.revision,
      payloadBytes: Buffer.byteLength(payload, "utf8"),
    });
  }

  await publishGameInvalidation(client, input.roomId, input.revision);
}

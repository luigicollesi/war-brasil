import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  isGameCommandPatch,
  type GameCommandPatch,
} from "@/src/lib/game-command-patch";
import {
  isGamePrivatePatch,
  type GamePrivatePatch,
} from "@/src/lib/game-private-patch";
import type { TradeCardDescriptor } from "@/src/lib/game-trade-rules";
import type { GameRealtimeBusEvent } from "./realtime/game-realtime-bus";
import { publishGameRealtimeBusEvent } from "./realtime/game-realtime-bus-runtime";
import { publishGameRealtimeMetric } from "./observability/game-realtime-metrics";

const GAME_REALTIME_NOTIFY_MAX_BYTES = 7_000;

type GameRealtimeInvalidationBusEvent = Extract<
  GameRealtimeBusEvent,
  { kind: "invalidate" }
>;
type GameRealtimePatchBusEvent = Extract<
  GameRealtimeBusEvent,
  { kind: "patch" }
>;
type GameRealtimePrivatePatchBusEvent = Extract<
  GameRealtimeBusEvent,
  { kind: "private_patch" }
>;
type GameRealtimeEphemeralBusEvent = Extract<
  GameRealtimeBusEvent,
  { kind: "ephemeral" }
>;
type GameRealtimeRevisionBusEvent =
  | GameRealtimeInvalidationBusEvent
  | GameRealtimePatchBusEvent
  | GameRealtimePrivatePatchBusEvent;

function gameRealtimeEnabled() {
  return process.env.GAME_REALTIME_ENABLED === "true";
}

function gameRealtimePatchesEnabled() {
  return process.env.GAME_REALTIME_PATCHES_ENABLED === "true";
}

function directEphemeralUrl() {
  const raw = process.env.GAME_REALTIME_INTERNAL_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

function directEphemeralToken() {
  return process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim() || null;
}

async function publishEphemeralDirect(event: GameRealtimeEphemeralBusEvent) {
  const baseUrl = directEphemeralUrl();
  if (!baseUrl) return null;

  const token = directEphemeralToken();
  if (!token) {
    throw new Error(
      "GAME_REALTIME_INTERNAL_TOKEN é obrigatório para entrega realtime direta.",
    );
  }

  const response = await fetch(`${baseUrl}/internal/ephemeral`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(event),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(`Gateway realtime recusou a entrega (${response.status}).`);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("delivered" in body) ||
    !("deliveredPlayers" in body) ||
    !("connectedPlayers" in body) ||
    typeof body.delivered !== "number" ||
    typeof body.deliveredPlayers !== "number" ||
    typeof body.connectedPlayers !== "number" ||
    !Number.isSafeInteger(body.delivered) ||
    !Number.isSafeInteger(body.deliveredPlayers) ||
    !Number.isSafeInteger(body.connectedPlayers) ||
    body.delivered < 0 ||
    body.deliveredPlayers < 0 ||
    body.connectedPlayers < 0
  ) {
    throw new Error("Gateway realtime retornou confirmação de entrega inválida.");
  }
  if (body.connectedPlayers < 2) {
    throw new Error(
      "A sinalização exige pelo menos dois jogadores conectados ao realtime.",
    );
  }
  if (body.deliveredPlayers !== body.connectedPlayers) {
    throw new Error(
      "Nem todos os jogadores conectados receberam a sinalização realtime.",
    );
  }

  return body.deliveredPlayers;
}

function invalidationEvent(
  roomId: string,
  revision: number,
  playerId?: string,
): GameRealtimeInvalidationBusEvent {
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
): GameRealtimePatchBusEvent {
  return {
    kind: "patch",
    scope: "room",
    roomId,
    baseRevision,
    revision,
    patch,
  };
}

function privatePatchEvent(
  roomId: string,
  playerId: string,
  baseRevision: number,
  revision: number,
  patch: GamePrivatePatch,
): GameRealtimePrivatePatchBusEvent {
  return {
    kind: "private_patch",
    scope: "player",
    roomId,
    playerId,
    baseRevision,
    revision,
    patch,
  };
}

async function publishEvent(
  client: PoolClient,
  event: GameRealtimeRevisionBusEvent,
  metricName:
    | "notify.publish"
    | "notify.private"
    | "notify.patch"
    | "notify.private_patch",
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

export async function publishPlayerGamePatch(
  client: PoolClient,
  input: {
    roomId: string;
    playerId: string;
    baseRevision: number;
    revision: number;
    patch: GamePrivatePatch;
  },
) {
  if (!gameRealtimeEnabled()) return;
  if (!/^\d+$/.test(input.playerId)) return;

  if (gameRealtimePatchesEnabled() && isGamePrivatePatch(input.patch)) {
    const event = privatePatchEvent(
      input.roomId,
      input.playerId,
      input.baseRevision,
      input.revision,
      input.patch,
    );
    const payloadBytes = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (payloadBytes <= GAME_REALTIME_NOTIFY_MAX_BYTES) {
      await publishEvent(client, event, "notify.private_patch");
      return;
    }

    publishGameRealtimeMetric({
      name: "notify.private_patch_fallback",
      roomId: input.roomId,
      revision: input.revision,
      payloadBytes,
    });
  }

  await publishPlayerGameInvalidation(
    client,
    input.roomId,
    input.playerId,
    input.revision,
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
  if (!gameRealtimeEnabled()) return false;

  const event: GameRealtimeEphemeralBusEvent = {
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
  };

  try {
    const delivered = await publishEphemeralDirect(event);
    if (delivered !== null) return true;

    await publishGameRealtimeBusEvent(client, event);
    return true;
  } catch {
    throw new Error("Não foi possível publicar a sinalização realtime.");
  }
}

export async function publishGameTradeResolution(
  client: PoolClient,
  input: {
    roomId: string;
    offerId: string;
    turnNumber: number;
    recipientPlayerId: string;
    actorPlayerId: string;
    outcome: "declined" | "counter_declined";
  },
) {
  if (!gameRealtimeEnabled()) return false;

  try {
    await publishGameRealtimeBusEvent(client, {
      kind: "ephemeral",
      scope: "room",
      roomId: input.roomId,
      eventId: randomUUID(),
      eventType: "trade.resolution",
      payload: {
        offerId: input.offerId,
        turnNumber: input.turnNumber,
        recipientPlayerId: input.recipientPlayerId,
        actorPlayerId: input.actorPlayerId,
        outcome: input.outcome,
      },
    });
    return true;
  } catch {
    return false;
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

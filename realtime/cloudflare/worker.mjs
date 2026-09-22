import { DurableObject } from "cloudflare:workers";
import {
  GAME_PROTOCOL_VERSION,
  GAME_REALTIME_MAX_PAYLOAD_BYTES,
  GAME_REALTIME_SUBPROTOCOL,
  parseClientMessage,
  parseNotificationPayload,
  serverEvent,
} from "../protocol.mjs";
import {
  realtimeTicketSecretConfigured,
  verifyGameRealtimeTicket,
  verifyUserRealtimeTicket,
} from "./ticket.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_BUFFERED_BYTES = 64 * 1024;
const MAX_PRESENCE_BATCH = 100;

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function allowedOrigins(env) {
  return new Set(
    (env.GAME_REALTIME_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return Boolean(origin) && allowedOrigins(env).has(origin);
}

function requestedSubprotocol(request) {
  const header = request.headers.get("Sec-WebSocket-Protocol");
  return Boolean(
    header
      ?.split(",")
      .map((value) => value.trim())
      .includes(GAME_REALTIME_SUBPROTOCOL),
  );
}

function isWebSocketUpgrade(request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function internalAuthError(request, env) {
  const token = env.GAME_REALTIME_INTERNAL_TOKEN?.trim();
  if (!token || token.length < 32) {
    return json({ error: "REALTIME_INTERNAL_NOT_CONFIGURED" }, 503);
  }
  if (request.headers.get("Authorization") !== `Bearer ${token}`) {
    return json({ error: "REALTIME_INTERNAL_UNAUTHORIZED" }, 401);
  }
  return null;
}

async function readJsonBody(request) {
  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength >
    GAME_REALTIME_MAX_PAYLOAD_BYTES
  ) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function maxBufferedBytes(env) {
  const parsed = Number(env.GAME_REALTIME_MAX_BUFFERED_BYTES);
  return Number.isFinite(parsed) && parsed >= 1024
    ? Math.floor(parsed)
    : DEFAULT_MAX_BUFFERED_BYTES;
}


function validUserId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function validPlayerId(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function socketAttachment(socket) {
  const value = socket.deserializeAttachment();
  return value && typeof value === "object" ? value : null;
}

function updateAttachment(socket, attachment, update) {
  const next = { ...attachment, ...update };
  socket.serializeAttachment(next);
  return next;
}

function closeForBackpressure(socket) {
  try {
    socket.close(1013, "Realtime congestionado; reconecte");
  } catch {
    // The runtime will eventually discard a broken socket.
  }
}

function safeSend(socket, payload, env) {
  if (socket.readyState !== 1) return false;
  if (socket.bufferedAmount > maxBufferedBytes(env)) {
    closeForBackpressure(socket);
    return false;
  }
  try {
    socket.send(payload);
    return true;
  } catch {
    try {
      socket.close(1011, "Falha de transporte realtime");
    } catch {
      // Ignore close failures for an already broken connection.
    }
    return false;
  }
}

function forwardRequest(request, headers) {
  const nextHeaders = new Headers(request.headers);
  for (const [name, value] of Object.entries(headers)) {
    nextHeaders.set(name, String(value));
  }
  return new Request(request, { headers: nextHeaders });
}

async function routeGameSocket(request, env, url) {
  const roomId = url.searchParams.get("roomId");
  if (!roomId || !/^\d+$/.test(roomId)) {
    return new Response("roomId inválido", { status: 400 });
  }
  const ticket = url.searchParams.get("ticket");
  const payload = ticket
    ? await verifyGameRealtimeTicket(
        ticket,
        env.GAME_REALTIME_TICKET_SECRET,
        roomId,
      )
    : null;
  if (!payload) {
    return new Response("Credencial realtime inválida", { status: 401 });
  }

  const stub = env.GAME_ROOM_REALTIME.getByName(roomId);
  return stub.fetch(
    forwardRequest(request, {
      "X-Realtime-Room-Id": roomId,
      "X-Realtime-Player-Id": payload.playerId,
      "X-Realtime-Revision": payload.revision,
    }),
  );
}

async function routeUserSocket(request, env, url) {
  const ticket = url.searchParams.get("ticket");
  const payload = ticket
    ? await verifyUserRealtimeTicket(ticket, env.GAME_REALTIME_TICKET_SECRET)
    : null;
  if (!payload) {
    return new Response("Credencial realtime de usuário inválida", {
      status: 401,
    });
  }

  const stub = env.USER_REALTIME.getByName(payload.userId);
  return stub.fetch(
    forwardRequest(request, {
      "X-Realtime-User-Id": payload.userId,
    }),
  );
}

async function publishGameEvent(request, env, ephemeralOnly = false) {
  const authError = internalAuthError(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const event = body ? parseNotificationPayload(JSON.stringify(body)) : null;
  if (!event || (ephemeralOnly && event.kind !== "ephemeral")) {
    return json({ error: "REALTIME_EVENT_INVALID" }, 422);
  }

  const stub = env.GAME_ROOM_REALTIME.getByName(event.roomId);
  return stub.fetch(
    new Request("https://game-room.internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }),
  );
}

async function notifyUser(request, env) {
  const authError = internalAuthError(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !validUserId(body.userId)
  ) {
    return json({ error: "USER_NOTIFICATION_INVALID" }, 422);
  }

  return env.USER_REALTIME.getByName(body.userId).fetch(
    new Request("https://user.internal/notify", { method: "POST" }),
  );
}

async function heartbeatPresence(request, env) {
  const authError = internalAuthError(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !validUserId(body.userId)
  ) {
    return json({ error: "PRESENCE_HEARTBEAT_INVALID" }, 422);
  }

  const observedAt = new Date().toISOString();
  return json({
    availability: "available",
    state: "online",
    observedAt,
    persistLastSeen: true,
  });
}

async function batchPresence(request, env) {
  const authError = internalAuthError(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Array.isArray(body.userIds)
  ) {
    return json({ error: "PRESENCE_BATCH_INVALID" }, 422);
  }

  const userIds = [...new Set(body.userIds)];
  if (
    userIds.length > MAX_PRESENCE_BATCH ||
    userIds.some((userId) => !validUserId(userId))
  ) {
    return json({ error: "PRESENCE_BATCH_INVALID" }, 422);
  }

  const presences = await Promise.all(
    userIds.map(async (userId) => {
      const response = await env.USER_REALTIME.getByName(userId).fetch(
        new Request("https://user.internal/presence"),
      );
      const presence = await response.json();
      return { userId, ...presence };
    }),
  );

  return json({ availability: "available", presences });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const ticketReady = realtimeTicketSecretConfigured(
        env.GAME_REALTIME_TICKET_SECRET,
      );
      const internalReady =
        typeof env.GAME_REALTIME_INTERNAL_TOKEN === "string" &&
        env.GAME_REALTIME_INTERNAL_TOKEN.trim().length >= 32;
      return json(
        {
          ready: ticketReady && internalReady,
          live: true,
          transport: "durable-object-websocket",
          hibernation: true,
        },
        ticketReady && internalReady ? 200 : 503,
      );
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/realtime" || url.pathname === "/user-realtime")
    ) {
      if (!isWebSocketUpgrade(request)) {
        return new Response("Upgrade: websocket obrigatório", { status: 426 });
      }
      if (!originAllowed(request, env)) {
        return new Response("Origin não permitida", { status: 403 });
      }
      if (!requestedSubprotocol(request)) {
        return new Response("Subprotocolo realtime obrigatório", {
          status: 426,
        });
      }
      return url.pathname === "/realtime"
        ? routeGameSocket(request, env, url)
        : routeUserSocket(request, env, url);
    }

    if (request.method === "POST" && url.pathname === "/internal/game-event") {
      return publishGameEvent(request, env);
    }
    if (request.method === "POST" && url.pathname === "/internal/ephemeral") {
      return publishGameEvent(request, env, true);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/internal/user-notification"
    ) {
      return notifyUser(request, env);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/internal/presence/heartbeat"
    ) {
      return heartbeatPresence(request, env);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/internal/presence/batch"
    ) {
      return batchPresence(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

export class GameRoomRealtimeDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (isWebSocketUpgrade(request)) {
      const roomId = request.headers.get("X-Realtime-Room-Id");
      const playerId = request.headers.get("X-Realtime-Player-Id");
      const revision = Number(request.headers.get("X-Realtime-Revision"));
      if (
        !roomId ||
        !/^\d+$/.test(roomId) ||
        !validPlayerId(playerId) ||
        !Number.isSafeInteger(revision) ||
        revision < 1
      ) {
        return new Response("Identidade realtime inválida", { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const attachment = {
        roomId,
        playerId,
        lastRevisionSent: revision,
        lastPrivateRevisionSent: 0,
        lastPrivatePatchRevisionSent: 0,
      };

      this.ctx.acceptWebSocket(server, [`player:${playerId}`]);
      server.serializeAttachment(attachment);
      server.send(serverEvent("realtime.ready", roomId, { revision }));

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          "Sec-WebSocket-Protocol": GAME_REALTIME_SUBPROTOCOL,
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/publish") {
      const body = await readJsonBody(request);
      const event = body ? parseNotificationPayload(JSON.stringify(body)) : null;
      if (!event) return json({ error: "REALTIME_EVENT_INVALID" }, 422);
      return json(this.broadcast(event));
    }

    return new Response("Not found", { status: 404 });
  }

  socketsForEvent(event) {
    if (event.scope === "player" && validPlayerId(event.playerId)) {
      return this.ctx.getWebSockets(`player:${event.playerId}`);
    }
    return this.ctx.getWebSockets();
  }

  broadcast(event) {
    const sockets = this.socketsForEvent(event);
    let delivered = 0;
    const connectedPlayers = new Set();
    const deliveredPlayers = new Set();

    for (const socket of sockets) {
      const attachment = socketAttachment(socket);
      if (!attachment || !validPlayerId(attachment.playerId)) continue;
      if (socket.readyState === 1) connectedPlayers.add(attachment.playerId);

      let payload = null;
      let update = null;

      if (event.kind === "ephemeral") {
        payload = serverEvent(event.eventType, event.roomId, event.payload);
      } else if (event.kind === "invalidate" && event.scope === "room") {
        if (event.revision <= (attachment.lastRevisionSent ?? 0)) continue;
        payload = serverEvent("game.invalidate", event.roomId, {
          revision: event.revision,
        });
        update = { lastRevisionSent: event.revision };
      } else if (event.kind === "invalidate" && event.scope === "player") {
        if (event.revision <= (attachment.lastPrivateRevisionSent ?? 0)) {
          continue;
        }
        payload = serverEvent("game.private.invalidate", event.roomId, {
          revision: event.revision,
        });
        update = { lastPrivateRevisionSent: event.revision };
      } else if (event.kind === "patch" && event.scope === "room") {
        if (event.revision <= (attachment.lastRevisionSent ?? 0)) continue;
        if (event.baseRevision !== (attachment.lastRevisionSent ?? 0)) {
          payload = serverEvent("game.invalidate", event.roomId, {
            revision: event.revision,
          });
        } else {
          payload = serverEvent("game.patch", event.roomId, {
            baseRevision: event.baseRevision,
            revision: event.revision,
            patch: event.patch,
          });
        }
        update = { lastRevisionSent: event.revision };
      } else if (event.kind === "patch" && event.scope === "player") {
        if (event.revision <= (attachment.lastPrivatePatchRevisionSent ?? 0)) {
          continue;
        }
        payload = serverEvent("game.private.patch", event.roomId, {
          baseRevision: event.baseRevision,
          revision: event.revision,
          patch: event.patch,
        });
        update = { lastPrivatePatchRevisionSent: event.revision };
      }

      if (!payload || !safeSend(socket, payload, this.env)) continue;
      delivered += 1;
      deliveredPlayers.add(attachment.playerId);
      if (update) updateAttachment(socket, attachment, update);
    }

    return {
      delivered,
      deliveredPlayers: deliveredPlayers.size,
      connectedPlayers: connectedPlayers.size,
    };
  }

  async webSocketMessage(socket, message) {
    if (typeof message !== "string") {
      socket.close(1003, "Payload realtime inválido");
      return;
    }

    const attachment = socketAttachment(socket);
    const parsed = attachment
      ? parseClientMessage(message, attachment.roomId)
      : null;
    if (!parsed) {
      socket.close(1002, "Mensagem realtime inválida");
      return;
    }

    safeSend(
      socket,
      serverEvent("realtime.pong", parsed.roomId, {
        clientTime: parsed.clientTime,
        nonce: parsed.nonce,
      }),
      this.env,
    );
  }

  async webSocketClose() {
    // With compatibility dates >= 2026-04-07 the runtime completes close frames.
  }

  async webSocketError(socket) {
    try {
      socket.close(1011, "Falha no canal realtime");
    } catch {
      // Socket already unavailable.
    }
  }
}

export class UserRealtimeDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (isWebSocketUpgrade(request)) {
      const userId = request.headers.get("X-Realtime-User-Id");
      if (!validUserId(userId)) {
        return new Response("Identidade realtime inválida", { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ userId });
      await this.ctx.storage.put("lastObservedAt", new Date().toISOString());
      server.send(
        JSON.stringify({
          protocolVersion: GAME_PROTOCOL_VERSION,
          type: "user.realtime.ready",
          serverTime: Date.now(),
          payload: {},
        }),
      );

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          "Sec-WebSocket-Protocol": GAME_REALTIME_SUBPROTOCOL,
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/notify") {
      let delivered = 0;
      const payload = JSON.stringify({
        protocolVersion: GAME_PROTOCOL_VERSION,
        type: "user.notifications.changed",
        serverTime: Date.now(),
        payload: {},
      });
      for (const socket of this.ctx.getWebSockets()) {
        if (safeSend(socket, payload, this.env)) delivered += 1;
      }
      return json({ delivered });
    }


    if (request.method === "GET" && url.pathname === "/presence") {
      const sockets = this.ctx.getWebSockets();
      const online = sockets.some((socket) => socket.readyState === 1);
      const storedLastSeen = online
        ? null
        : await this.ctx.storage.get("lastObservedAt");
      return json({
        state: online ? "online" : "offline",
        lastSeenAt:
          online
            ? new Date().toISOString()
            : typeof storedLastSeen === "string"
              ? storedLastSeen
              : null,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(socket) {
    socket.close(1008, "Canal de notificação é somente leitura");
  }

  async webSocketClose() {
    await this.ctx.storage.put("lastObservedAt", new Date().toISOString());
  }

  async webSocketError(socket) {
    try {
      socket.close(1011, "Falha no canal de notificação");
    } catch {
      // Socket already unavailable.
    }
  }
}

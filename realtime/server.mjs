import http from "node:http";
import { Pool } from "pg";
import WebSocket, { WebSocketServer } from "ws";
import {
  readRealtimeIdentity,
  readRealtimeIdentityByPlayer,
} from "./auth.mjs";
import { PostgresRealtimeListener } from "./listener.mjs";
import { realtimeMetricsSnapshot, recordRealtimeMetric } from "./metrics.mjs";
import { RedisPresenceStore } from "./presence-store.mjs";
import {
  GAME_REALTIME_MAX_PAYLOAD_BYTES,
  GAME_REALTIME_PATH,
  GAME_REALTIME_SUBPROTOCOL,
  parseClientMessage,
  parseNotificationPayload,
  serverEvent,
} from "./protocol.mjs";
import { RedisRoomSubscriber } from "./redis-room-subscriber.mjs";
import { GameRealtimeRegistry } from "./registry.mjs";
import {
  realtimeTicketConfigured,
  verifyRealtimeTicket,
} from "./ticket.mjs";

if (process.env.GAME_REALTIME_ENABLED !== "true") {
  console.log("War-Brasil realtime gateway desabilitado (GAME_REALTIME_ENABLED != true).");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não está configurada para o realtime gateway.");
}

const port = Number(process.env.GAME_REALTIME_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("GAME_REALTIME_PORT inválida.");
}

const internalToken = process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim() || null;
const eventSourceMode = process.env.GAME_REALTIME_EVENT_SOURCE?.trim() || "postgres";
if (!new Set(["postgres", "dual", "redis"]).has(eventSourceMode)) {
  throw new Error(
    `GAME_REALTIME_EVENT_SOURCE inválido: ${eventSourceMode}. Use postgres, dual ou redis.`,
  );
}

const authMode = process.env.GAME_REALTIME_AUTH_MODE?.trim() || "cookie";
if (!new Set(["cookie", "ticket", "either"]).has(authMode)) {
  throw new Error(
    `GAME_REALTIME_AUTH_MODE inválido: ${authMode}. Use cookie, ticket ou either.`,
  );
}
if (authMode !== "cookie" && !realtimeTicketConfigured()) {
  throw new Error(
    "GAME_REALTIME_TICKET_SECRET com pelo menos 32 caracteres é obrigatório para autenticação por ticket.",
  );
}

const redisUrl = process.env.GAME_REALTIME_REDIS_URL?.trim() || null;
if (eventSourceMode !== "postgres" && !redisUrl) {
  throw new Error(
    "GAME_REALTIME_REDIS_URL é obrigatória quando o event source usa Redis.",
  );
}

function allowedOrigins() {
  const configured = process.env.GAME_REALTIME_ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured?.length) return new Set(configured);
  if (process.env.NODE_ENV !== "production") {
    return new Set([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  }
  return new Set();
}

function rejectUpgrade(socket, statusCode, message) {
  const body = `${message}\n`;
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      "\r\n" +
      body,
  );
  socket.destroy();
}

function requestedSubprotocol(request) {
  const header = request.headers["sec-websocket-protocol"];
  if (typeof header !== "string") return false;
  return header
    .split(",")
    .map((value) => value.trim())
    .includes(GAME_REALTIME_SUBPROTOCOL);
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > GAME_REALTIME_MAX_PAYLOAD_BYTES) {
      throw new Error("Payload interno realtime muito grande.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function authorizeInternalRequest(request, response) {
  if (!internalToken) {
    writeJson(response, 503, { error: "Canal interno realtime não configurado." });
    return false;
  }
  if (request.headers.authorization !== `Bearer ${internalToken}`) {
    writeJson(response, 401, { error: "Credencial interna realtime inválida." });
    return false;
  }
  return true;
}

const origins = allowedOrigins();
const pool = new Pool({ connectionString, max: 5 });
const registry = new GameRealtimeRegistry();
const presenceStore = new RedisPresenceStore({
  url: redisUrl,
  ttlSeconds: process.env.PROFILE_PRESENCE_TTL_SECONDS,
  lastSeenThrottleSeconds: process.env.PROFILE_LAST_SEEN_THROTTLE_SECONDS,
});
let eventSourceHealthy = false;
let redisShadowHealthy = eventSourceMode !== "dual";
let acceptingUpgrades = false;
let shuttingDown = false;
const recentPrimaryEvents = new Map();

function gatewayReady() {
  return acceptingUpgrades && eventSourceHealthy && !shuttingDown;
}

function eventKey(event) {
  if (event.kind === "ephemeral") {
    return `${event.roomId}:ephemeral:${event.eventId}`;
  }
  return `${event.roomId}:${event.revision}:${event.kind}:${event.scope}`;
}

function rememberPrimaryEvent(event) {
  recentPrimaryEvents.set(eventKey(event), Date.now());
  if (recentPrimaryEvents.size <= 1_000) return;
  const oldest = recentPrimaryEvents.keys().next().value;
  if (oldest !== undefined) recentPrimaryEvents.delete(oldest);
}

function handleRealtimeEvent(event) {
  rememberPrimaryEvent(event);
  if (event.kind === "ephemeral") {
    registry.broadcastEphemeral(event);
    return;
  }
  if (event.kind === "patch") {
    registry.broadcastPatch(event);
    return;
  }
  registry.broadcastInvalidation(
    event.roomId,
    event.revision,
    event.scope === "player" ? event.playerId : null,
  );
}

function handlePrimarySourceHealth(healthy) {
  eventSourceHealthy = healthy;
  if (!healthy) {
    registry.closeAll(1012, "Canal realtime temporariamente indisponível");
  }
}

function handleRedisShadowEvent(event) {
  const observedAt = recentPrimaryEvents.get(eventKey(event));
  recordRealtimeMetric("redisShadowEvents", {
    roomId: event.roomId,
    revision: event.kind === "ephemeral" ? null : event.revision,
    eventType: event.kind === "ephemeral" ? event.eventType : null,
    matchedPrimary: observedAt !== undefined,
    deliveryDeltaMs: observedAt === undefined ? null : Date.now() - observedAt,
  });
}

function handleRedisShadowHealth(healthy) {
  redisShadowHealthy = healthy;
  recordRealtimeMetric("redisShadowHealth", { healthy });
}

const postgresSource =
  eventSourceMode === "redis"
    ? null
    : new PostgresRealtimeListener({
        connectionString,
        onEvent: handleRealtimeEvent,
        onHealthChange: handlePrimarySourceHealth,
      });
const redisSource =
  eventSourceMode === "postgres"
    ? null
    : new RedisRoomSubscriber({
        url: redisUrl,
        onEvent:
          eventSourceMode === "redis" ? handleRealtimeEvent : handleRedisShadowEvent,
        onHealthChange:
          eventSourceMode === "redis"
            ? handlePrimarySourceHealth
            : handleRedisShadowHealth,
      });
const primarySource = eventSourceMode === "redis" ? redisSource : postgresSource;

async function acquireRoomSource(roomId) {
  if (!redisSource) return;
  try {
    await redisSource.acquireRoom(roomId);
  } catch (error) {
    recordRealtimeMetric("redisRoomAcquireFailures", {
      roomId,
      mode: eventSourceMode,
      error: error instanceof Error ? error.message : String(error),
    });
    if (eventSourceMode === "redis") throw error;
  }
}

async function releaseRoomSource(roomId) {
  if (!redisSource) return;
  await redisSource.releaseRoom(roomId).catch(() => undefined);
}

async function freshRealtimeIdentity(identity) {
  if (identity.authKind === "ticket") {
    return readRealtimeIdentityByPlayer(pool, identity.roomId, identity.playerId);
  }
  return readRealtimeIdentity(pool, identity.roomId, identity.cookieHeader);
}

async function authenticateUpgrade(roomId, url, cookieHeader) {
  if (authMode !== "cookie") {
    const ticket = url.searchParams.get("ticket");
    if (ticket) {
      const payload = verifyRealtimeTicket(ticket, roomId);
      if (payload) {
        const identity = await readRealtimeIdentityByPlayer(
          pool,
          roomId,
          payload.playerId,
        );
        if (identity) {
          return {
            ...identity,
            authKind: "ticket",
            roomId,
            cookieHeader: null,
          };
        }
      }
    }
    if (authMode === "ticket") return null;
  }

  const identity = await readRealtimeIdentity(pool, roomId, cookieHeader);
  return identity
    ? {
        ...identity,
        authKind: "cookie",
        roomId,
        cookieHeader,
      }
    : null;
}

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: GAME_REALTIME_MAX_PAYLOAD_BYTES,
  perMessageDeflate: false,
  handleProtocols(protocols) {
    return protocols.has(GAME_REALTIME_SUBPROTOCOL)
      ? GAME_REALTIME_SUBPROTOCOL
      : false;
  },
});

async function setupConnection(socket, identity) {
  try {
    await acquireRoomSource(identity.roomId);
  } catch {
    socket.close(1012, "Não foi possível assinar a sala realtime");
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    await releaseRoomSource(identity.roomId);
    return;
  }

  const context = registry.add(socket, {
    roomId: identity.roomId,
    playerId: identity.playerId,
  });

  let releasedSource = false;
  const releaseSourceOnce = () => {
    if (releasedSource) return;
    releasedSource = true;
    void releaseRoomSource(context.roomId);
  };

  socket.on("pong", () => registry.markAlive(socket));
  socket.on("close", () => {
    registry.remove(socket);
    releaseSourceOnce();
  });
  socket.on("error", () => undefined);
  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      recordRealtimeMetric("protocolErrors", { roomId: context.roomId });
      socket.close(1003, "Mensagens binárias não são suportadas");
      return;
    }

    const text = data.toString("utf8");
    if (Buffer.byteLength(text) > GAME_REALTIME_MAX_PAYLOAD_BYTES) {
      recordRealtimeMetric("protocolErrors", { roomId: context.roomId });
      socket.close(1009, "Mensagem muito grande");
      return;
    }

    const message = parseClientMessage(text, context.roomId);
    if (!message) {
      recordRealtimeMetric("protocolErrors", { roomId: context.roomId });
      socket.close(1002, "Mensagem realtime inválida");
      return;
    }

    socket.send(
      serverEvent("realtime.pong", context.roomId, {
        clientTime: message.clientTime,
        nonce: message.nonce,
      }),
    );
  });

  const freshIdentity = await freshRealtimeIdentity(identity).catch(() => null);

  if (
    !freshIdentity ||
    freshIdentity.playerId !== identity.playerId ||
    !gatewayReady()
  ) {
    socket.close(1012, "Não foi possível confirmar o estado realtime");
    return;
  }

  registry.sendReady(socket, freshIdentity.revision);
}

function statusBody() {
  return {
    ready: gatewayReady(),
    live: !shuttingDown,
    acceptingUpgrades,
    eventSourceMode,
    eventSourceHealthy,
    redisShadowHealthy: eventSourceMode === "dual" ? redisShadowHealthy : null,
    presenceAvailable: presenceStore.isAvailable(),
    authMode,
    connections: registry.size(),
    rooms: registry.roomCount(),
    sourceRooms: redisSource ? redisSource.roomCount() : null,
    metrics: realtimeMetricsSnapshot(),
  };
}

async function handleInternalEphemeral(request, response) {
  if (!gatewayReady()) {
    writeJson(response, 503, { error: "Realtime indisponível." });
    return;
  }
  if (!authorizeInternalRequest(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const event = parseNotificationPayload(JSON.stringify(body));
    if (!event || event.kind !== "ephemeral") {
      writeJson(response, 422, { error: "Evento efêmero realtime inválido." });
      return;
    }

    const delivery = registry.broadcastEphemeral(event);
    writeJson(response, 200, delivery);
  } catch {
    writeJson(response, 400, { error: "Payload interno realtime inválido." });
  }
}

async function handleInternalPresenceHeartbeat(request, response) {
  if (!authorizeInternalRequest(request, response)) return;

  try {
    const body = await readJsonBody(request);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.userId !== "string"
    ) {
      writeJson(response, 422, { error: "Heartbeat de presença inválido." });
      return;
    }

    const result = await presenceStore.heartbeat(body.userId);
    writeJson(response, result.availability === "available" ? 200 : 503, result);
  } catch {
    writeJson(response, 422, { error: "Heartbeat de presença inválido." });
  }
}

async function handleInternalPresenceBatch(request, response) {
  if (!authorizeInternalRequest(request, response)) return;

  try {
    const body = await readJsonBody(request);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Array.isArray(body.userIds)
    ) {
      writeJson(response, 422, { error: "Consulta de presença inválida." });
      return;
    }

    const result = await presenceStore.readMany(body.userIds);
    writeJson(response, result.availability === "available" ? 200 : 503, result);
  } catch {
    writeJson(response, 422, { error: "Consulta de presença inválida." });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/internal/ephemeral") {
    void handleInternalEphemeral(request, response);
    return;
  }

  if (
    request.method === "POST" &&
    request.url === "/internal/presence/heartbeat"
  ) {
    void handleInternalPresenceHeartbeat(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/internal/presence/batch") {
    void handleInternalPresenceBatch(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/health/live") {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ live: !shuttingDown, shuttingDown }));
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/health" || request.url === "/health/ready")
  ) {
    const body = JSON.stringify(statusBody());
    response.writeHead(gatewayReady() ? 200 : 503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(body);
    return;
  }

  response.writeHead(404);
  response.end();
});

server.on("upgrade", async (request, socket, head) => {
  const origin = request.headers.origin;
  if (!origin || !origins.has(origin)) {
    rejectUpgrade(socket, 403, "Origin não permitida");
    return;
  }

  if (!gatewayReady()) {
    rejectUpgrade(socket, 503, "Realtime indisponível");
    return;
  }

  if (!requestedSubprotocol(request)) {
    rejectUpgrade(socket, 400, "Subprotocol realtime obrigatório");
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== GAME_REALTIME_PATH) {
    rejectUpgrade(socket, 404, "Path realtime inválido");
    return;
  }

  const roomId = url.searchParams.get("room");
  if (!roomId || !/^\d+$/.test(roomId)) {
    rejectUpgrade(socket, 400, "Sala realtime inválida");
    return;
  }

  const identity = await authenticateUpgrade(
    roomId,
    url,
    request.headers.cookie ?? "",
  ).catch(() => null);
  if (!identity) {
    rejectUpgrade(socket, 401, "Sessão realtime inválida");
    return;
  }

  wss.handleUpgrade(request, socket, head, (client) => {
    void setupConnection(client, identity);
  });
});

const heartbeatIntervalMs = 15_000;
const heartbeat = setInterval(() => registry.heartbeat(), heartbeatIntervalMs);
heartbeat.unref();

async function start() {
  presenceStore.start();
  primarySource?.start();
  if (redisSource && eventSourceMode === "dual") {
    redisSource.start();
  }

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });

  acceptingUpgrades = true;
  console.log(`War-Brasil realtime gateway listening on :${port}`);
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  acceptingUpgrades = false;
  clearInterval(heartbeat);
  registry.closeAll(1012, "Realtime em manutenção");
  await primarySource?.stop().catch(() => undefined);
  if (redisSource && redisSource !== primarySource) {
    await redisSource.stop().catch(() => undefined);
  }
  presenceStore.stop();
  await pool.end().catch(() => undefined);
  await new Promise((resolve) => server.close(() => resolve()));
}

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

await start();

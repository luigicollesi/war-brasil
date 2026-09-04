import http from "node:http";
import { Pool } from "pg";
import WebSocket, { WebSocketServer } from "ws";
import {
  readRealtimeIdentity,
  readRealtimeIdentityByPlayer,
} from "./auth.mjs";
import { PostgresRealtimeListener } from "./listener.mjs";
import { realtimeMetricsSnapshot, recordRealtimeMetric } from "./metrics.mjs";
import {
  GAME_REALTIME_MAX_PAYLOAD_BYTES,
  GAME_REALTIME_PATH,
  GAME_REALTIME_SUBPROTOCOL,
  parseClientMessage,
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

const origins = allowedOrigins();
const pool = new Pool({ connectionString, max: 5 });
const registry = new GameRealtimeRegistry();
let eventSourceHealthy = false;
let redisShadowHealthy = eventSourceMode !== "dual";
let acceptingUpgrades = false;
let shuttingDown = false;
const recentPrimaryEvents = new Map();

function gatewayReady() {
  return acceptingUpgrades && eventSourceHealthy && !shuttingDown;
}

function eventKey(event) {
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
    revision: event.revision,
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
    authMode,
    connections: registry.size(),
    rooms: registry.roomCount(),
    sourceRooms: redisSource ? redisSource.roomCount() : null,
    metrics: realtimeMetricsSnapshot(),
  };
}

const server = http.createServer((request, response) => {
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

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found\n");
});

server.on("upgrade", async (request, socket, head) => {
  try {
    if (!gatewayReady()) {
      rejectUpgrade(socket, 503, "Realtime indisponível");
      return;
    }

    const origin = request.headers.origin;
    if (!origin || !origins.has(origin)) {
      recordRealtimeMetric("authRejected", { reason: "origin" });
      rejectUpgrade(socket, 403, "Origin não permitida");
      return;
    }

    if (!requestedSubprotocol(request)) {
      recordRealtimeMetric("authRejected", { reason: "protocol" });
      rejectUpgrade(socket, 426, "Subprotocolo realtime obrigatório");
      return;
    }

    const url = new URL(request.url ?? "/", "http://realtime.local");
    if (url.pathname !== GAME_REALTIME_PATH) {
      rejectUpgrade(socket, 404, "Endpoint realtime não encontrado");
      return;
    }

    const roomId = url.searchParams.get("roomId");
    if (!roomId || !/^\d+$/.test(roomId)) {
      recordRealtimeMetric("authRejected", { reason: "room" });
      rejectUpgrade(socket, 400, "roomId inválido");
      return;
    }

    const identity = await authenticateUpgrade(
      roomId,
      url,
      request.headers.cookie,
    );
    if (!identity) {
      recordRealtimeMetric("authRejected", { reason: "session_or_ticket", roomId });
      rejectUpgrade(socket, 401, "Credencial realtime inválida");
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      void setupConnection(ws, identity);
    });
  } catch {
    recordRealtimeMetric("authRejected", { reason: "internal" });
    rejectUpgrade(socket, 500, "Falha ao iniciar conexão realtime");
  }
});

const heartbeat = setInterval(() => registry.heartbeat(), 30_000);
heartbeat.unref?.();

if (!primarySource) {
  throw new Error("Realtime primary event source não foi configurado.");
}
await primarySource.start();
if (eventSourceMode === "dual" && redisSource) {
  await redisSource.start().catch((error) => {
    redisShadowHealthy = false;
    recordRealtimeMetric("redisShadowStartFailure", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
server.listen(port, "0.0.0.0", () => {
  acceptingUpgrades = true;
  console.log(
    `War-Brasil realtime gateway ouvindo na porta ${port} (${eventSourceMode}/${authMode}).`,
  );
});

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  acceptingUpgrades = false;
  recordRealtimeMetric("draining", {
    connections: registry.size(),
    rooms: registry.roomCount(),
    eventSourceMode,
  });
  clearInterval(heartbeat);
  registry.closeAll(1012, "Servidor reiniciando");
  if (redisSource && redisSource !== primarySource) {
    await redisSource.stop();
  }
  await primarySource.stop();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}

import http from "node:http";
import { Pool } from "pg";
import WebSocket, { WebSocketServer } from "ws";
import { readRealtimeIdentity } from "./auth.mjs";
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
if (!new Set(["postgres", "redis"]).has(eventSourceMode)) {
  throw new Error(
    `GAME_REALTIME_EVENT_SOURCE inválido: ${eventSourceMode}. Use postgres ou redis.`,
  );
}

const redisUrl = process.env.GAME_REALTIME_REDIS_URL?.trim() || null;
if (eventSourceMode === "redis" && !redisUrl) {
  throw new Error("GAME_REALTIME_REDIS_URL é obrigatória quando o event source é redis.");
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
let acceptingUpgrades = false;
let shuttingDown = false;

function gatewayReady() {
  return acceptingUpgrades && eventSourceHealthy && !shuttingDown;
}

function handleRealtimeEvent(event) {
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

function handleSourceHealth(healthy) {
  eventSourceHealthy = healthy;
  if (!healthy) {
    registry.closeAll(1012, "Canal realtime temporariamente indisponível");
  }
}

const eventSource =
  eventSourceMode === "redis"
    ? new RedisRoomSubscriber({
        url: redisUrl,
        onEvent: handleRealtimeEvent,
        onHealthChange: handleSourceHealth,
      })
    : new PostgresRealtimeListener({
        connectionString,
        onEvent: handleRealtimeEvent,
        onHealthChange: handleSourceHealth,
      });

async function acquireRoomSource(roomId) {
  if (eventSourceMode !== "redis") return;
  await eventSource.acquireRoom(roomId);
}

async function releaseRoomSource(roomId) {
  if (eventSourceMode !== "redis") return;
  await eventSource.releaseRoom(roomId);
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

  const freshIdentity = await readRealtimeIdentity(
    pool,
    identity.roomId,
    identity.cookieHeader,
  ).catch(() => null);

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
    connections: registry.size(),
    rooms: registry.roomCount(),
    sourceRooms:
      eventSourceMode === "redis" && typeof eventSource.roomCount === "function"
        ? eventSource.roomCount()
        : null,
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

    const identity = await readRealtimeIdentity(
      pool,
      roomId,
      request.headers.cookie,
    );
    if (!identity) {
      recordRealtimeMetric("authRejected", { reason: "session", roomId });
      rejectUpgrade(socket, 401, "Sessão sem acesso à partida");
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      void setupConnection(ws, {
        roomId,
        playerId: identity.playerId,
        cookieHeader: request.headers.cookie,
      });
    });
  } catch {
    recordRealtimeMetric("authRejected", { reason: "internal" });
    rejectUpgrade(socket, 500, "Falha ao iniciar conexão realtime");
  }
});

const heartbeat = setInterval(() => registry.heartbeat(), 30_000);
heartbeat.unref?.();

await eventSource.start();
server.listen(port, "0.0.0.0", () => {
  acceptingUpgrades = true;
  console.log(
    `War-Brasil realtime gateway ouvindo na porta ${port} (${eventSourceMode}).`,
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
  await eventSource.stop();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}

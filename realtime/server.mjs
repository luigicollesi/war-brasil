import http from "node:http";
import { Pool } from "pg";
import { WebSocketServer } from "ws";
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
let listenerHealthy = false;

const listener = new PostgresRealtimeListener({
  connectionString,
  onEvent: (event) => {
    if (event.kind === "patch") {
      registry.broadcastPatch(event);
      return;
    }
    registry.broadcastInvalidation(
      event.roomId,
      event.revision,
      event.scope === "player" ? event.playerId : null,
    );
  },
  onHealthChange: (healthy) => {
    listenerHealthy = healthy;
    if (!healthy) {
      registry.closeAll(1012, "Canal realtime temporariamente indisponível");
    }
  },
});

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
  const context = registry.add(socket, {
    roomId: identity.roomId,
    playerId: identity.playerId,
  });

  socket.on("pong", () => registry.markAlive(socket));
  socket.on("close", () => registry.remove(socket));
  socket.on("error", () => {});
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
    !listenerHealthy
  ) {
    socket.close(1012, "Não foi possível confirmar o estado realtime");
    return;
  }

  registry.sendReady(socket, freshIdentity.revision);
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const body = JSON.stringify({
      healthy: listenerHealthy,
      connections: registry.size(),
      metrics: realtimeMetricsSnapshot(),
    });
    response.writeHead(listenerHealthy ? 200 : 503, {
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
    if (!listenerHealthy) {
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

await listener.start();
server.listen(port, "0.0.0.0", () => {
  console.log(`War-Brasil realtime gateway ouvindo na porta ${port}.`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(heartbeat);
  registry.closeAll(1001, "Servidor reiniciando");
  await listener.stop();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}

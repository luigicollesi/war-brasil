"use client";

import {
  GAME_PROTOCOL_VERSION,
  GAME_REALTIME_SUBPROTOCOL,
  isGameRealtimeEvent,
  type GameRealtimeClientMessage,
} from "@/src/lib/game-realtime-contract";
import { GameServerClock } from "../sync/game-server-clock";
import type {
  GameRealtimeConnectionInput,
  GameRealtimeListener,
  GameRealtimeState,
  GameRealtimeStateListener,
  GameRealtimeTransport,
} from "./game-realtime-transport";

const MAX_RECONNECT_DELAY_MS = 15_000;
const PING_INTERVAL_MS = 30_000;
const DEGRADED_AFTER_ATTEMPTS = 4;

type WebSocketGameRealtimeTransportOptions = {
  url?: string;
  authMode?: "cookie" | "ticket";
};

function websocketHostname() {
  const hostname = window.location.hostname;
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

function connectionUrl(
  configuredUrl: string | undefined,
  roomId: string,
  ticket?: string,
) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const configuredPort = process.env.NEXT_PUBLIC_GAME_REALTIME_PORT?.trim();
  const url = configuredUrl
    ? new URL(configuredUrl, window.location.href)
    : configuredPort
      ? new URL(`${protocol}//${websocketHostname()}:${configuredPort}/realtime`)
      : new URL(`${protocol}//${window.location.host}/realtime`);
  url.searchParams.set("roomId", roomId);
  if (ticket) url.searchParams.set("ticket", ticket);
  return url.toString();
}

async function fetchRealtimeTicket(roomId: string) {
  const response = await fetch(`/api/games/${encodeURIComponent(roomId)}/realtime-ticket`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Não foi possível obter ticket realtime (${response.status}).`);
  }
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("ticket" in body) ||
    typeof body.ticket !== "string" ||
    body.ticket.length < 32
  ) {
    throw new Error("Resposta de ticket realtime inválida.");
  }
  return body.ticket;
}

function pingNonce() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class WebSocketGameRealtimeTransport implements GameRealtimeTransport {
  private readonly listeners = new Set<GameRealtimeListener>();
  private readonly stateListeners = new Set<GameRealtimeStateListener>();
  private readonly serverClock = new GameServerClock();
  private socket: WebSocket | null = null;
  private input: GameRealtimeConnectionInput | null = null;
  private currentState: GameRealtimeState = "idle";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private manuallyClosed = false;
  private opening = false;

  constructor(private readonly options: WebSocketGameRealtimeTransportOptions = {}) {}

  async connect(input: GameRealtimeConnectionInput) {
    this.input = input;
    this.manuallyClosed = false;
    this.clearReconnectTimer();

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING ||
      this.opening
    ) {
      return;
    }

    await this.openSocket();
  }

  subscribe(listener: GameRealtimeListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeState(listener: GameRealtimeStateListener) {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  state() {
    return this.currentState;
  }

  clock() {
    return this.serverClock.snapshot();
  }

  disconnect() {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.clearPingTimer();
    const socket = this.socket;
    this.socket = null;
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close(1000, "Cliente desconectado");
    }
    this.transition("closed");
  }

  private async openSocket() {
    const input = this.input;
    if (!input || this.manuallyClosed || this.opening) return;
    this.opening = true;

    this.transition(
      this.reconnectAttempt >= DEGRADED_AFTER_ATTEMPTS
        ? "degraded"
        : this.reconnectAttempt > 0
          ? "reconnecting"
          : "connecting",
    );

    let ticket: string | undefined;
    try {
      if (this.options.authMode === "ticket") {
        ticket = await fetchRealtimeTicket(input.roomId);
      }
    } catch {
      this.opening = false;
      if (!this.manuallyClosed) this.scheduleReconnect();
      return;
    }

    if (this.manuallyClosed || this.input?.roomId !== input.roomId) {
      this.opening = false;
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(
        connectionUrl(this.options.url, input.roomId, ticket),
        GAME_REALTIME_SUBPROTOCOL,
      );
    } catch {
      this.opening = false;
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    this.opening = false;

    socket.onopen = () => {
      if (this.socket !== socket || this.manuallyClosed) return;
      if (socket.protocol !== GAME_REALTIME_SUBPROTOCOL) {
        socket.close(1002, "Subprotocolo realtime incompatível");
      }
    };

    socket.onmessage = (message) => {
      if (this.socket !== socket || typeof message.data !== "string") {
        socket.close(1003, "Payload realtime inválido");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        socket.close(1002, "JSON realtime inválido");
        return;
      }

      if (!isGameRealtimeEvent(parsed) || parsed.roomId !== input.roomId) {
        socket.close(1002, "Evento realtime incompatível");
        return;
      }

      if (parsed.type === "realtime.ready") {
        this.reconnectAttempt = 0;
        this.transition("connected");
        this.startPingTimer();
        this.sendPing();
      } else if (parsed.type === "realtime.pong") {
        this.serverClock.recordSample(
          parsed.payload.clientTime,
          parsed.serverTime,
          Date.now(),
        );
      }

      for (const listener of this.listeners) listener(parsed);
    };

    socket.onerror = () => undefined;
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      this.clearPingTimer();
      if (this.manuallyClosed) {
        this.transition("closed");
        return;
      }
      if (event.code === 1002 || event.code === 1003) {
        this.transition("degraded");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.reconnectTimer) return;

    this.reconnectAttempt += 1;
    this.transition(
      this.reconnectAttempt >= DEGRADED_AFTER_ATTEMPTS
        ? "degraded"
        : "reconnecting",
    );

    const base = Math.min(
      MAX_RECONNECT_DELAY_MS,
      500 * 2 ** Math.min(this.reconnectAttempt - 1, 5),
    );
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.round(base * jitter);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  private sendPing() {
    const socket = this.socket;
    const input = this.input;
    if (!socket || socket.readyState !== WebSocket.OPEN || !input) return;

    const message: GameRealtimeClientMessage = {
      protocolVersion: GAME_PROTOCOL_VERSION,
      type: "realtime.ping",
      roomId: input.roomId,
      clientTime: Date.now(),
      nonce: pingNonce(),
    };
    socket.send(JSON.stringify(message));
  }

  private startPingTimer() {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private clearPingTimer() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private transition(state: GameRealtimeState) {
    if (this.currentState === state) return;
    this.currentState = state;
    for (const listener of this.stateListeners) listener(state);
  }
}

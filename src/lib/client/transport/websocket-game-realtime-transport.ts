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
};

function connectionUrl(configuredUrl: string | undefined, roomId: string) {
  const url = configuredUrl
    ? new URL(configuredUrl, window.location.href)
    : new URL(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/realtime`,
      );
  url.searchParams.set("roomId", roomId);
  return url.toString();
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

  constructor(private readonly options: WebSocketGameRealtimeTransportOptions = {}) {}

  async connect(input: GameRealtimeConnectionInput) {
    this.input = input;
    this.manuallyClosed = false;
    this.clearReconnectTimer();

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.openSocket();
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

  private openSocket() {
    const input = this.input;
    if (!input || this.manuallyClosed) return;

    this.transition(
      this.reconnectAttempt >= DEGRADED_AFTER_ATTEMPTS
        ? "degraded"
        : this.reconnectAttempt > 0
          ? "reconnecting"
          : "connecting",
    );

    let socket: WebSocket;
    try {
      socket = new WebSocket(
        connectionUrl(this.options.url, input.roomId),
        GAME_REALTIME_SUBPROTOCOL,
      );
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket || this.manuallyClosed) return;
      if (socket.protocol !== GAME_REALTIME_SUBPROTOCOL) {
        socket.close(1002, "Subprotocolo realtime incompatível");
        return;
      }
      this.reconnectAttempt = 0;
      this.transition("connected");
      this.startPingTimer();
      this.sendPing();
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

      if (parsed.type === "realtime.pong") {
        this.serverClock.recordSample(
          parsed.payload.clientTime,
          parsed.serverTime,
          Date.now(),
        );
      }

      for (const listener of this.listeners) listener(parsed);
    };

    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.clearPingTimer();
      if (this.manuallyClosed) {
        this.transition("closed");
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
      this.openSocket();
    }, delay);
  }

  private sendPing() {
    const socket = this.socket;
    const input = this.input;
    if (!socket || !input || socket.readyState !== WebSocket.OPEN) return;

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

  private transition(next: GameRealtimeState) {
    if (this.currentState === next) return;
    this.currentState = next;
    for (const listener of this.stateListeners) listener(next);
  }
}

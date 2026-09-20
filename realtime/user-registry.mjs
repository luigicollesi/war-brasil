import WebSocket from "ws";
import { recordRealtimeMetric } from "./metrics.mjs";

export class UserRealtimeRegistry {
  constructor() {
    this.users = new Map();
    this.contexts = new Map();
  }

  add(socket, userId) {
    const context = { socket, userId, isAlive: true };
    this.contexts.set(socket, context);
    const user = this.users.get(userId) ?? new Set();
    user.add(context);
    this.users.set(userId, user);
    recordRealtimeMetric("userConnections", { userId });
    return context;
  }

  remove(socket) {
    const context = this.contexts.get(socket);
    if (!context) return;
    const user = this.users.get(context.userId);
    user?.delete(context);
    if (user?.size === 0) this.users.delete(context.userId);
    this.contexts.delete(socket);
    recordRealtimeMetric("userDisconnects", { userId: context.userId });
  }

  markAlive(socket) {
    const context = this.contexts.get(socket);
    if (context) context.isAlive = true;
  }

  notify(userId) {
    const user = this.users.get(userId);
    if (!user) return { delivered: 0, connected: 0 };

    let delivered = 0;
    let connected = 0;
    const message = JSON.stringify({
      protocolVersion: 2,
      type: "user.notifications.changed",
      serverTime: Date.now(),
      payload: {},
    });

    for (const context of user) {
      if (context.socket.readyState !== WebSocket.OPEN) continue;
      connected += 1;
      try {
        context.socket.send(message);
        delivered += 1;
      } catch {
        context.socket.terminate();
      }
    }

    recordRealtimeMetric("userNotificationBroadcasts", {
      userId,
      delivered,
      connected,
    });
    return { delivered, connected };
  }

  heartbeat() {
    for (const context of this.contexts.values()) {
      if (context.socket.readyState !== WebSocket.OPEN) continue;
      if (!context.isAlive) {
        context.socket.terminate();
        continue;
      }
      context.isAlive = false;
      try {
        context.socket.ping();
      } catch {
        context.socket.terminate();
      }
    }
  }

  closeAll(code = 1012, reason = "Realtime temporariamente indisponível") {
    for (const context of this.contexts.values()) {
      try {
        context.socket.close(code, reason);
      } catch {
        context.socket.terminate();
      }
    }
  }

  size() {
    return this.contexts.size;
  }

  userCount() {
    return this.users.size;
  }
}

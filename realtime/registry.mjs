import WebSocket from "ws";
import { recordRealtimeMetric } from "./metrics.mjs";
import { serverEvent } from "./protocol.mjs";

const DEFAULT_MAX_BUFFERED_BYTES = 64 * 1024;
const FLUSH_RETRY_MS = 50;

function maxBufferedBytes() {
  const parsed = Number(process.env.GAME_REALTIME_MAX_BUFFERED_BYTES);
  return Number.isFinite(parsed) && parsed >= 1024
    ? parsed
    : DEFAULT_MAX_BUFFERED_BYTES;
}

export class GameRealtimeRegistry {
  constructor() {
    this.rooms = new Map();
    this.contexts = new Map();
  }

  add(socket, identity) {
    const context = {
      socket,
      roomId: identity.roomId,
      playerId: identity.playerId,
      isAlive: true,
      lastRevisionSent: 0,
      lastPrivateRevisionSent: 0,
      lastPrivatePatchRevisionSent: 0,
      pendingRevision: null,
      pendingPrivateRevision: null,
      flushTimer: null,
    };

    this.contexts.set(socket, context);
    const room = this.rooms.get(identity.roomId) ?? new Set();
    room.add(context);
    this.rooms.set(identity.roomId, room);
    recordRealtimeMetric("connections", {
      roomId: identity.roomId,
      playerId: identity.playerId,
    });
    return context;
  }

  remove(socket) {
    const context = this.contexts.get(socket);
    if (!context) return;

    if (context.flushTimer) clearTimeout(context.flushTimer);
    const room = this.rooms.get(context.roomId);
    room?.delete(context);
    if (room?.size === 0) this.rooms.delete(context.roomId);
    this.contexts.delete(socket);
    recordRealtimeMetric("disconnects", {
      roomId: context.roomId,
      playerId: context.playerId,
    });
  }

  markAlive(socket) {
    const context = this.contexts.get(socket);
    if (context) context.isAlive = true;
  }

  sendReady(socket, revision) {
    const context = this.contexts.get(socket);
    if (!context || socket.readyState !== WebSocket.OPEN) return false;

    const readyRevision = Math.max(context.lastRevisionSent, revision);
    try {
      socket.send(
        serverEvent("realtime.ready", context.roomId, {
          revision: readyRevision,
        }),
      );
      context.lastRevisionSent = readyRevision;
      return true;
    } catch {
      socket.terminate();
      return false;
    }
  }

  broadcastInvalidation(roomId, revision, playerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const context of room) {
      if (playerId !== null) {
        if (context.playerId !== playerId) continue;
        this.sendPrivateRevision(context, revision);
        continue;
      }
      this.sendRevision(context, revision);
    }
  }

  broadcastPatch(event) {
    if (event.scope === "player") {
      this.broadcastPrivatePatch(event);
      return;
    }

    const room = this.rooms.get(event.roomId);
    if (!room) return;

    for (const context of room) {
      this.sendPatch(context, event);
    }
  }

  broadcastPrivatePatch(event) {
    const room = this.rooms.get(event.roomId);
    if (!room) return;

    for (const context of room) {
      if (context.playerId !== event.playerId) continue;
      this.sendPrivatePatch(context, event);
    }
  }

  broadcastEphemeral(event) {
    const room = this.rooms.get(event.roomId);
    if (!room) {
      return { delivered: 0, deliveredPlayers: 0, connectedPlayers: 0 };
    }

    let delivered = 0;
    const connectedPlayerIds = new Set();
    const deliveredPlayerIds = new Set();

    for (const context of room) {
      if (context.socket.readyState === WebSocket.OPEN) {
        connectedPlayerIds.add(context.playerId);
      }

      if (
        context.socket.readyState !== WebSocket.OPEN ||
        context.socket.bufferedAmount > maxBufferedBytes()
      ) {
        recordRealtimeMetric("ephemeralDropped", {
          roomId: event.roomId,
          eventType: event.eventType,
        });
        continue;
      }

      try {
        context.socket.send(
          serverEvent(event.eventType, event.roomId, event.payload),
        );
        delivered += 1;
        deliveredPlayerIds.add(context.playerId);
        recordRealtimeMetric("ephemeralBroadcasts", {
          roomId: event.roomId,
          eventType: event.eventType,
        });
      } catch {
        context.socket.terminate();
      }
    }

    return {
      delivered,
      deliveredPlayers: deliveredPlayerIds.size,
      connectedPlayers: connectedPlayerIds.size,
    };
  }

  sendPatch(context, event) {
    if (
      context.socket.readyState !== WebSocket.OPEN ||
      event.revision <= context.lastRevisionSent
    ) {
      return;
    }

    if (
      context.pendingRevision !== null ||
      context.pendingPrivateRevision !== null ||
      context.socket.bufferedAmount > maxBufferedBytes()
    ) {
      context.pendingRevision = Math.max(
        context.pendingRevision ?? 0,
        event.revision,
      );
      recordRealtimeMetric("patchCoalesced", {
        roomId: context.roomId,
        revision: event.revision,
      });
      this.scheduleFlush(context);
      return;
    }

    if (event.baseRevision !== context.lastRevisionSent) {
      recordRealtimeMetric("patchFallbacks", {
        roomId: context.roomId,
        baseRevision: event.baseRevision,
        revision: event.revision,
        lastRevisionSent: context.lastRevisionSent,
      });
      this.sendRevision(context, event.revision);
      return;
    }

    try {
      context.socket.send(
        serverEvent("game.patch", context.roomId, {
          baseRevision: event.baseRevision,
          revision: event.revision,
          patch: event.patch,
        }),
      );
      context.lastRevisionSent = event.revision;
      recordRealtimeMetric("patchBroadcasts", {
        roomId: context.roomId,
        revision: event.revision,
      });
    } catch {
      context.socket.terminate();
    }
  }

  sendPrivatePatch(context, event) {
    if (
      context.socket.readyState !== WebSocket.OPEN ||
      event.revision <= context.lastPrivatePatchRevisionSent
    ) {
      return;
    }

    if (context.socket.bufferedAmount > maxBufferedBytes()) {
      recordRealtimeMetric("privatePatchFallbacks", {
        roomId: context.roomId,
        playerId: context.playerId,
        revision: event.revision,
      });
      this.sendPrivateRevision(context, event.revision);
      return;
    }

    try {
      context.socket.send(
        serverEvent("game.private.patch", context.roomId, {
          baseRevision: event.baseRevision,
          revision: event.revision,
          patch: event.patch,
        }),
      );
      context.lastPrivatePatchRevisionSent = event.revision;
      recordRealtimeMetric("privatePatchBroadcasts", {
        roomId: context.roomId,
        playerId: context.playerId,
        revision: event.revision,
      });
    } catch {
      context.socket.terminate();
    }
  }

  sendRevision(context, revision) {
    if (
      context.socket.readyState !== WebSocket.OPEN ||
      revision <= context.lastRevisionSent
    ) {
      return;
    }

    if (context.socket.bufferedAmount > maxBufferedBytes()) {
      context.pendingRevision = Math.max(context.pendingRevision ?? 0, revision);
      recordRealtimeMetric("coalesced", {
        roomId: context.roomId,
        revision,
      });
      this.scheduleFlush(context);
      return;
    }

    try {
      context.socket.send(
        serverEvent("game.invalidate", context.roomId, { revision }),
      );
      context.lastRevisionSent = revision;
      recordRealtimeMetric("broadcasts", {
        roomId: context.roomId,
        revision,
      });
    } catch {
      context.socket.terminate();
    }
  }

  sendPrivateRevision(context, revision) {
    if (
      context.socket.readyState !== WebSocket.OPEN ||
      revision <= context.lastPrivateRevisionSent
    ) {
      return;
    }

    if (context.socket.bufferedAmount > maxBufferedBytes()) {
      context.pendingPrivateRevision = Math.max(
        context.pendingPrivateRevision ?? 0,
        revision,
      );
      recordRealtimeMetric("privateCoalesced", {
        roomId: context.roomId,
        playerId: context.playerId,
        revision,
      });
      this.scheduleFlush(context);
      return;
    }

    try {
      context.socket.send(
        serverEvent("game.private.invalidate", context.roomId, { revision }),
      );
      context.lastPrivateRevisionSent = revision;
      recordRealtimeMetric("privateBroadcasts", {
        roomId: context.roomId,
        playerId: context.playerId,
        revision,
      });
    } catch {
      context.socket.terminate();
    }
  }

  scheduleFlush(context) {
    if (context.flushTimer) return;
    context.flushTimer = setTimeout(() => {
      context.flushTimer = null;
      this.flushPending(context);
    }, FLUSH_RETRY_MS);
    context.flushTimer.unref?.();
  }

  flushPending(context) {
    if (context.socket.readyState !== WebSocket.OPEN) return;

    if (context.socket.bufferedAmount > maxBufferedBytes()) {
      this.scheduleFlush(context);
      return;
    }

    const privateRevision = context.pendingPrivateRevision;
    context.pendingPrivateRevision = null;
    if (privateRevision !== null) {
      this.sendPrivateRevision(context, privateRevision);
    }

    const revision = context.pendingRevision;
    context.pendingRevision = null;
    if (revision !== null) {
      this.sendRevision(context, revision);
    }
  }

  heartbeat() {
    for (const context of this.contexts.values()) {
      if (context.socket.readyState !== WebSocket.OPEN) continue;
      if (!context.isAlive) {
        context.socket.terminate();
        continue;
      }

      context.isAlive = false;
      this.flushPending(context);
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

  roomCount() {
    return this.rooms.size;
  }
}

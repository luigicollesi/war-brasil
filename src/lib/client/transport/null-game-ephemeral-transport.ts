"use client";

import type {
  GameEphemeralEvent,
  GameEphemeralListener,
  GameEphemeralTransport,
} from "./game-ephemeral-transport";

export class NullGameEphemeralTransport implements GameEphemeralTransport {
  async connect(_roomId: string) {}

  send(_event: GameEphemeralEvent) {}

  subscribe(_listener: GameEphemeralListener) {
    return () => undefined;
  }

  disconnect() {}
}

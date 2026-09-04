"use client";

import type { GameEphemeralTransport } from "./game-ephemeral-transport";

export class NullGameEphemeralTransport implements GameEphemeralTransport {
  async connect() {}

  send() {}

  subscribe() {
    return () => undefined;
  }

  disconnect() {}
}

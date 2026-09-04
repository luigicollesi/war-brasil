"use client";

import type { GameEphemeralTransport } from "./game-ephemeral-transport";
import { NullGameEphemeralTransport } from "./null-game-ephemeral-transport";

export function createGameEphemeralTransport(): GameEphemeralTransport {
  return new NullGameEphemeralTransport();
}

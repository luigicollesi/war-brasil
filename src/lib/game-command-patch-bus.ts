"use client";

import type { ApplicableGameCommandResult } from "@/src/lib/game-command-patch";

type PatchHandler = (result: ApplicableGameCommandResult) => boolean;

const handlersByRoom = new Map<string, Set<PatchHandler>>();

export function registerGameCommandPatchHandler(
  roomId: string,
  handler: PatchHandler,
) {
  const handlers = handlersByRoom.get(roomId) ?? new Set<PatchHandler>();
  handlers.add(handler);
  handlersByRoom.set(roomId, handlers);

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) handlersByRoom.delete(roomId);
  };
}

export function dispatchGameCommandPatch(
  roomId: string,
  result: ApplicableGameCommandResult,
) {
  const handlers = handlersByRoom.get(roomId);
  if (!handlers?.size) return false;

  for (const handler of handlers) {
    if (handler(result)) return true;
  }

  return false;
}

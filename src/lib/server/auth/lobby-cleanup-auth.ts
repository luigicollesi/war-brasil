import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { RoomError } from "@/src/lib/server/room-error";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function assertLobbyCleanupRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const configuredTokens = [
    process.env.GAME_AUTOMATION_WORKER_TOKEN?.trim(),
    process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim(),
  ].filter((value): value is string => Boolean(value));

  if (configuredTokens.length === 0) {
    throw new RoomError("Cleanup interno do lobby não está configurado.", 503);
  }

  const authorized = configuredTokens.some((token) =>
    safeEqual(authorization, `Bearer ${token}`),
  );
  if (!authorized) {
    throw new RoomError("Cleanup interno do lobby não autorizado.", 401);
  }
}

import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { RoomError } from "@/src/lib/rooms";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function assertGameAutomationWorkerRequest(request: NextRequest) {
  const token = process.env.GAME_AUTOMATION_WORKER_TOKEN?.trim();
  if (!token) {
    throw new RoomError("Automation worker não está configurado.", 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${token}`)) {
    throw new RoomError("Automation worker não autorizado.", 401);
  }
}

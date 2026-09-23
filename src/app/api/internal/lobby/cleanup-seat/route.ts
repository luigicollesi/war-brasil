import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { cleanupStaleWaitingRoomSeat } from "@/src/lib/rooms";
import { assertLobbyCleanupRequest } from "@/src/lib/server/auth/lobby-cleanup-auth";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | undefined;
  try {
    assertLobbyCleanupRequest(request);
    body = await readJsonObject(request);
    const result = await cleanupStaleWaitingRoomSeat(
      body.roomId,
      body.playerId,
      20,
    );

    if (result.removed && !result.roomDeleted && result.roomCode) {
      await publishLobbyChangeByCode(result.roomCode);
    }

    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "internal_cleanup_waiting_room_seat",
      route: request.nextUrl.pathname,
      input: body,
    });
  }
}

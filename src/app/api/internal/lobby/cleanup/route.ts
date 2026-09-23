import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { cleanupStaleWaitingRoomSeats } from "@/src/lib/rooms";
import { assertGameAutomationWorkerRequest } from "@/src/lib/server/automation/game-automation-worker-auth";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

export async function POST(request: NextRequest) {
  try {
    assertGameAutomationWorkerRequest(request);
    const result = await cleanupStaleWaitingRoomSeats(20, 100);
    await Promise.all(
      result.changedRoomCodes.map((code) => publishLobbyChangeByCode(code)),
    );
    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "internal_cleanup_waiting_rooms",
      route: request.nextUrl.pathname,
    });
  }
}

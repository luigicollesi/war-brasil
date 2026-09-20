import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { cleanupStaleWaitingRoomSeats } from "@/src/lib/rooms";
import { assertGameAutomationWorkerRequest } from "@/src/lib/server/automation/game-automation-worker-auth";

export async function POST(request: NextRequest) {
  try {
    assertGameAutomationWorkerRequest(request);
    const result = await cleanupStaleWaitingRoomSeats(90, 100);
    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "internal_cleanup_waiting_rooms",
      route: request.nextUrl.pathname,
    });
  }
}

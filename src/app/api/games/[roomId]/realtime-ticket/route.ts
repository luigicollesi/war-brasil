import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { issueGameRealtimeTicket } from "@/src/lib/server/realtime/game-realtime-ticket";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: RouteContext) {
  let roomId: string | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de abrir o realtime.", 401);
    }

    ({ roomId } = await params);
    const result = await issueGameRealtimeTicket(roomId, session);
    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "issue_game_realtime_ticket",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}

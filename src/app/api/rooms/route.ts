import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";
import { createRoom } from "@/src/lib/rooms";

export async function POST(request: NextRequest) {
  try {
    const session = getOrCreatePlayerSession(request);
    const room = await createRoom(session.value);
    return persistPlayerSession(noStoreJson({ room }), session);
  } catch (error) {
    return roomErrorResponse(error, { operation: "create_room", route: request.nextUrl.pathname });
  }
}

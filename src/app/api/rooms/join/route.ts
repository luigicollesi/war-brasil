import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";
import { joinRoom } from "@/src/lib/rooms";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | undefined;
  try {
    const session = getOrCreatePlayerSession(request);
    body = await readJsonObject(request);
    const room = await joinRoom(body.code, session.value);
    return persistPlayerSession(noStoreJson({ room }), session);
  } catch (error) {
    return roomErrorResponse(error, { operation: "join_room", route: request.nextUrl.pathname, input: body });
  }
}

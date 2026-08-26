import { NextRequest } from "next/server";
import { noStoreJson, readJsonObject, roomErrorResponse } from "@/src/lib/api-response";
import { reinforce } from "@/src/lib/game";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  let roomId: string | undefined;
  let body: Record<string, unknown> | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) throw new RoomError("Entre em uma sala antes de jogar.", 401);
    ({ roomId } = await params);
    body = await readJsonObject(request);
    return noStoreJson(await reinforce(roomId, session, body));
  } catch (error) {
    return roomErrorResponse(error, { operation: "reinforce", route: request.nextUrl.pathname, resource: { roomId }, input: body });
  }
}

import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { rollBattleDice } from "@/src/lib/game";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  let roomId: string | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) throw new RoomError("Entre em uma sala antes de jogar.", 401);
    ({ roomId } = await params);
    return noStoreJson(await rollBattleDice(roomId, session));
  } catch (error) {
    return roomErrorResponse(error, { operation: "roll_battle_dice", route: request.nextUrl.pathname, resource: { roomId } });
  }
}

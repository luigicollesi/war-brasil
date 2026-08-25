import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { rollOrderDie } from "@/src/lib/game";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  let roomId: string | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de rolar o dado.", 401);
    }

    ({ roomId } = await params);
    return noStoreJson(await rollOrderDie(roomId, session));
  } catch (error) {
    return roomErrorResponse(error, { operation: "roll_order_die", route: request.nextUrl.pathname, resource: { roomId } });
  }
}

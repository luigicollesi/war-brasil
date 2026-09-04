import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { signalPlayerTradeCard } from "@/src/lib/server/game-player-trade-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  let roomId: string | undefined;

  try {
    ({ roomId } = await params);

    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de jogar.", 401);
    }
    if (process.env.GAME_REALTIME_ENABLED !== "true") {
      throw new RoomError(
        "A sinalização de posse está indisponível porque o canal realtime não está ativo.",
        503,
      );
    }

    const body = await readJsonObject(request);
    const result = await signalPlayerTradeCard(roomId, session, body);
    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "player_trade_signal",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}

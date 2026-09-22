import "server-only";

import { runPostResponseTask } from "../cloudflare/post-response-task";
import { pool } from "../db/pool";
import { publishCommittedGameRealtimeBusEvent } from "./game-realtime-bus-runtime";

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export async function publishLobbyChangeByCode(codeValue: string) {
  if (process.env.GAME_REALTIME_ENABLED !== "true") return false;
  const code = codeValue.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) return false;

  try {
    const result = await pool.query<{ id: string; revision: number }>(
      `UPDATE game.rooms
          SET revision=revision+1
        WHERE code=$1
        RETURNING id::text,revision`,
      [code],
    );
    const room = result.rows[0];
    if (!room) return false;

    await runPostResponseTask("lobby.realtime", () =>
      publishCommittedGameRealtimeBusEvent({
        kind: "invalidate",
        scope: "room",
        roomId: room.id,
        revision: room.revision,
      }),
    );
    return true;
  } catch (error) {
    console.warn("[lobby-realtime] invalidation failed", {
      code,
      reason: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

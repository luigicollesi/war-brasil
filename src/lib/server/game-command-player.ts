import "server-only";

import type { PoolClient } from "pg";
import { RoomError } from "@/src/lib/rooms";

export type CommandPlayer = {
  id: string;
  turn_position: number | null;
};

type CachedCommandPlayer = {
  roomId: string;
  session: string;
  accountUserId: string | null;
  player: CommandPlayer;
};

const commandPlayerCache = new WeakMap<PoolClient, CachedCommandPlayer>();

async function loadCommandPlayer(
  client: PoolClient,
  roomId: string,
  session: string,
  accountUserId: string | null,
) {
  const player = (
    await client.query<CommandPlayer>(
      `SELECT id,turn_position
       FROM game.players
       WHERE room_id=$1
         AND player_session=$2
         AND ($3::uuid IS NULL OR user_id=$3::uuid)
         AND is_bot=FALSE
         AND left_at IS NULL
       FOR UPDATE`,
      [roomId, session, accountUserId],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }

  commandPlayerCache.set(client, {
    roomId,
    session,
    accountUserId,
    player,
  });
  return player;
}

export async function primeCommandPlayer(
  client: PoolClient,
  roomId: string,
  session: string,
  accountUserId?: string | null,
) {
  return loadCommandPlayer(
    client,
    roomId,
    session,
    accountUserId?.trim() || null,
  );
}

export async function resolveCommandPlayerBySession(
  client: PoolClient,
  roomId: string,
  session: string,
  accountUserId?: string | null,
): Promise<CommandPlayer> {
  const normalizedUserId = accountUserId?.trim() || null;
  const cached = commandPlayerCache.get(client);
  if (
    cached &&
    cached.roomId === roomId &&
    cached.session === session &&
    (normalizedUserId === null ||
      cached.accountUserId === normalizedUserId)
  ) {
    return cached.player;
  }

  return loadCommandPlayer(client, roomId, session, normalizedUserId);
}

export function clearCommandPlayerCache(client: PoolClient) {
  commandPlayerCache.delete(client);
}

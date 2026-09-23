import "server-only";

import type { PoolClient } from "pg";
import { pool } from "@/src/lib/server/db/pool";
import { RoomError } from "@/src/lib/server/room-error";

export type ActiveParticipationStatus =
  | "waiting"
  | "order_roll"
  | "playing"
  | "finished";

export type ActiveParticipation = Readonly<{
  playerId: string;
  roomId: string;
  roomCode: string;
  status: ActiveParticipationStatus;
  kind: "lobby" | "game";
  target: string;
}>;

type ParticipationQueryable = Pick<PoolClient, "query">;

type ParticipationRow = {
  player_id: string;
  room_id: string;
  room_code: string;
  status: ActiveParticipationStatus;
};

const PARTICIPATION_LOCK_SEED = 20260923;

function toParticipation(row: ParticipationRow): ActiveParticipation {
  const kind = row.status === "waiting" ? "lobby" : "game";
  return {
    playerId: row.player_id,
    roomId: row.room_id,
    roomCode: row.room_code,
    status: row.status,
    kind,
    target: `/${kind}/${row.room_code}`,
  };
}

async function readActiveParticipationRows(
  userId: string,
  db: ParticipationQueryable,
) {
  return (
    await db.query<ParticipationRow>(
      `SELECT player.id::text AS player_id,
              room.id::text AS room_id,
              room.code AS room_code,
              room.status
         FROM game.players player
         JOIN game.rooms room ON room.id=player.room_id
        WHERE player.user_id=$1::uuid
          AND player.is_bot=FALSE
          AND player.left_at IS NULL
        ORDER BY
          CASE room.status
            WHEN 'playing' THEN 0
            WHEN 'order_roll' THEN 1
            WHEN 'finished' THEN 2
            ELSE 3
          END,
          player.joined_at,
          player.id
        LIMIT 2`,
      [userId],
    )
  ).rows;
}

export async function lockActiveParticipationForUser(
  client: PoolClient,
  userId: string,
) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text,$2::bigint))",
    [userId, PARTICIPATION_LOCK_SEED],
  );
}

export async function findActiveParticipationForUser(
  userId: string,
  db: ParticipationQueryable = pool,
): Promise<ActiveParticipation | null> {
  const rows = await readActiveParticipationRows(userId, db);
  if (rows.length > 1) {
    throw new RoomError(
      "A conta possui mais de uma participação ativa. Saia das operações antigas antes de continuar.",
      409,
      {
        reason: "multiple_active_participations",
        roomCodes: rows.map((row) => row.room_code),
      },
    );
  }

  return rows[0] ? toParticipation(rows[0]) : null;
}

export async function assertActiveParticipationAvailable(
  client: PoolClient,
  userId: string,
  targetRoomId: string | null = null,
) {
  const active = await findActiveParticipationForUser(userId, client);
  if (!active || (targetRoomId && active.roomId === targetRoomId)) {
    return active;
  }

  throw new RoomError(
    active.kind === "lobby"
      ? "Você já está em outra sala de operação."
      : "Você já está em uma partida ativa.",
    409,
    {
      reason: "active_participation",
      roomCode: active.roomCode,
      roomStatus: active.status,
      target: active.target,
    },
  );
}

export async function resumeActiveParticipation(
  userId: string,
  playerSession: string,
) {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await lockActiveParticipationForUser(client, userId);

    const active = await findActiveParticipationForUser(userId, client);
    if (!active) {
      await client.query("COMMIT");
      transactionOpen = false;
      return null;
    }

    const conflictingSeat = (
      await client.query<{ id: string }>(
        `SELECT id::text
           FROM game.players
          WHERE room_id=$1::bigint
            AND player_session=$2::uuid
            AND id<>$3::bigint
          FOR UPDATE`,
        [active.roomId, playerSession, active.playerId],
      )
    ).rows[0];

    if (conflictingSeat) {
      throw new RoomError(
        "A sessão local já está vinculada a outro assento desta operação.",
        409,
        { reason: "player_session_conflict", roomCode: active.roomCode },
      );
    }

    await client.query(
      `UPDATE game.players
          SET player_session=$2::uuid,
              lobby_last_seen_at=CASE
                WHEN $3='waiting' THEN NOW()
                ELSE lobby_last_seen_at
              END
        WHERE id=$1::bigint
          AND user_id=$4::uuid
          AND is_bot=FALSE`,
      [active.playerId, playerSession, active.status, userId],
    );

    await client.query("COMMIT");
    transactionOpen = false;
    return active;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}

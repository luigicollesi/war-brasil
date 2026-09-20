import "server-only";

import type { PoolClient } from "pg";
import type {
  GameInvitationState,
  GameInvitationSummary,
} from "@/src/lib/game-invitations/game-invitation-contract";
import { pool } from "../db/pool";

export type InvitationQueryable = Pick<PoolClient, "query">;

type InvitationRow = {
  id: string;
  room_id: string;
  room_code: string;
  inviter_user_id: string;
  invitee_user_id: string;
  inviter_handle: string;
  inviter_display_name: string;
  invitee_handle: string;
  invitee_display_name: string;
  state: GameInvitationState;
  created_at: Date;
  expires_at: Date;
};

function invitationFromRow(row: InvitationRow): GameInvitationSummary {
  return {
    id: row.id,
    roomCode: row.room_code,
    inviter: {
      handle: row.inviter_handle,
      displayName: row.inviter_display_name,
    },
    invitee: {
      handle: row.invitee_handle,
      displayName: row.invitee_display_name,
    },
    state: row.state,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  };
}

export async function expireStaleInvitations(
  userId: string,
  db: InvitationQueryable = pool,
) {
  await db.query(
    `UPDATE game.room_invitations
        SET state='expired',resolved_reason='expired',resolved_at=NOW()
      WHERE state='pending'
        AND expires_at<=NOW()
        AND (inviter_user_id=$1::uuid OR invitee_user_id=$1::uuid)`,
    [userId],
  );
}

export async function insertRoomInvitation(
  roomId: string,
  roomCode: string,
  inviterUserId: string,
  inviteeUserId: string,
  db: InvitationQueryable = pool,
) {
  const result = await db.query<{ id: string; expires_at: Date }>(
    `INSERT INTO game.room_invitations(
       room_id,room_code_snapshot,inviter_user_id,invitee_user_id
     )
     VALUES($1::bigint,$2,$3::uuid,$4::uuid)
     RETURNING id,expires_at`,
    [roomId, roomCode, inviterUserId, inviteeUserId],
  );
  return result.rows[0];
}

export async function findPendingInvitationBetween(
  inviterUserId: string,
  inviteeUserId: string,
  db: InvitationQueryable = pool,
) {
  const result = await db.query<{
    id: string;
    room_code: string;
    expires_at: Date;
  }>(
    `SELECT invitation.id,
            invitation.room_code_snapshot AS room_code,
            invitation.expires_at
       FROM game.room_invitations invitation
       JOIN game.rooms room ON room.id=invitation.room_id
      WHERE invitation.inviter_user_id=$1::uuid
        AND invitation.invitee_user_id=$2::uuid
        AND invitation.state='pending'
        AND invitation.expires_at>NOW()
        AND room.status='waiting'
      ORDER BY invitation.created_at DESC
      LIMIT 1`,
    [inviterUserId, inviteeUserId],
  );
  return result.rows[0] ?? null;
}

export async function listIncomingRoomInvitations(
  userId: string,
  db: InvitationQueryable = pool,
): Promise<GameInvitationSummary[]> {
  await expireStaleInvitations(userId, db);
  const result = await db.query<InvitationRow>(
    `SELECT invitation.id,
            invitation.room_id,
            invitation.room_code_snapshot AS room_code,
            invitation.inviter_user_id,
            invitation.invitee_user_id,
            inviter.handle AS inviter_handle,
            inviter.display_name AS inviter_display_name,
            invitee.handle AS invitee_handle,
            invitee.display_name AS invitee_display_name,
            invitation.state,
            invitation.created_at,
            invitation.expires_at
       FROM game.room_invitations invitation
       JOIN game.rooms room ON room.id=invitation.room_id
       JOIN profile.commanders inviter
         ON inviter.user_id=invitation.inviter_user_id
       JOIN profile.commanders invitee
         ON invitee.user_id=invitation.invitee_user_id
      WHERE invitation.invitee_user_id=$1::uuid
        AND invitation.state='pending'
        AND invitation.expires_at>NOW()
        AND room.status='waiting'
      ORDER BY invitation.created_at DESC,invitation.id`,
    [userId],
  );
  return result.rows.map(invitationFromRow);
}

export async function listOutgoingRoomInvitations(
  userId: string,
  db: InvitationQueryable = pool,
): Promise<GameInvitationSummary[]> {
  await expireStaleInvitations(userId, db);
  const result = await db.query<InvitationRow>(
    `SELECT invitation.id,
            invitation.room_id,
            invitation.room_code_snapshot AS room_code,
            invitation.inviter_user_id,
            invitation.invitee_user_id,
            inviter.handle AS inviter_handle,
            inviter.display_name AS inviter_display_name,
            invitee.handle AS invitee_handle,
            invitee.display_name AS invitee_display_name,
            invitation.state,
            invitation.created_at,
            invitation.expires_at
       FROM game.room_invitations invitation
       JOIN game.rooms room ON room.id=invitation.room_id
       JOIN profile.commanders inviter
         ON inviter.user_id=invitation.inviter_user_id
       JOIN profile.commanders invitee
         ON invitee.user_id=invitation.invitee_user_id
      WHERE invitation.inviter_user_id=$1::uuid
        AND invitation.state='pending'
        AND invitation.expires_at>NOW()
        AND room.status='waiting'
      ORDER BY invitation.created_at DESC,invitation.id`,
    [userId],
  );
  return result.rows.map(invitationFromRow);
}

export async function lockIncomingRoomInvitation(
  invitationId: string,
  inviteeUserId: string,
  db: InvitationQueryable,
) {
  const result = await db.query<{
    id: string;
    room_id: string;
    room_code: string;
    inviter_user_id: string;
    invitee_user_id: string;
    state: GameInvitationState;
    expires_at: Date;
    room_status: string | null;
    room_exists: boolean;
  }>(
    `SELECT invitation.id,
            invitation.room_id,
            invitation.room_code_snapshot AS room_code,
            invitation.inviter_user_id,
            invitation.invitee_user_id,
            invitation.state,
            invitation.expires_at,
            room.status AS room_status,
            (room.id IS NOT NULL) AS room_exists
       FROM game.room_invitations invitation
       LEFT JOIN game.rooms room ON room.id=invitation.room_id
      WHERE invitation.id=$1::uuid
        AND invitation.invitee_user_id=$2::uuid
      FOR UPDATE OF invitation`,
    [invitationId, inviteeUserId],
  );
  return result.rows[0] ?? null;
}

export async function lockOutgoingRoomInvitation(
  invitationId: string,
  inviterUserId: string,
  db: InvitationQueryable,
) {
  const result = await db.query<{
    id: string;
    state: GameInvitationState;
    expires_at: Date;
  }>(
    `SELECT id,state,expires_at
       FROM game.room_invitations
      WHERE id=$1::uuid
        AND inviter_user_id=$2::uuid
      FOR UPDATE`,
    [invitationId, inviterUserId],
  );
  return result.rows[0] ?? null;
}

export async function resolveRoomInvitation(
  invitationId: string,
  state: Exclude<GameInvitationState, "pending">,
  db: InvitationQueryable,
  reason:
    | "accepted"
    | "rejected"
    | "cancelled"
    | "expired"
    | "room_started"
    | "room_full"
    | "room_deleted"
    | "room_empty"
    | "host_left" = state,
) {
  await db.query(
    `UPDATE game.room_invitations
        SET state=$2,resolved_reason=$3,resolved_at=NOW()
      WHERE id=$1::uuid
        AND state='pending'`,
    [invitationId, state, reason],
  );
}

export async function deleteWaitingRoomOwnedByUser(
  roomId: string,
  userId: string,
  db: InvitationQueryable = pool,
) {
  await db.query(
    `DELETE FROM game.rooms room
      WHERE room.id=$1::bigint
        AND room.status='waiting'
        AND EXISTS (
          SELECT 1
            FROM game.players player
           WHERE player.room_id=room.id
             AND player.user_id=$2::uuid
             AND player.is_bot=FALSE
        )
        AND NOT EXISTS (
          SELECT 1
            FROM game.players other
           WHERE other.room_id=room.id
             AND other.user_id IS DISTINCT FROM $2::uuid
             AND other.is_bot=FALSE
        )`,
    [roomId, userId],
  );
}

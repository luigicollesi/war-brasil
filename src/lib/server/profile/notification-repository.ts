import "server-only";

import type { PoolClient } from "pg";
import type {
  UserNotification,
  UserNotificationKind,
} from "@/src/lib/profile/user-notification-contract";
import { pool } from "../db/pool";

type NotificationQueryable = Pick<PoolClient, "query">;

type NotificationRow = {
  id: string;
  kind: UserNotificationKind;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
  expires_at: Date | null;
};

function stringPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
}

function notificationFromRow(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    kind: row.kind,
    entityId: row.entity_id,
    payload: stringPayload(row.payload),
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
  };
}

export async function listUnreadNotifications(
  userId: string,
  db: NotificationQueryable = pool,
): Promise<UserNotification[]> {
  const result = await db.query<NotificationRow>(
    `SELECT id,kind,entity_id,payload,created_at,expires_at
       FROM profile.notifications
      WHERE user_id=$1::uuid
        AND read_at IS NULL
        AND (expires_at IS NULL OR expires_at>NOW())
      ORDER BY created_at,id
      LIMIT 20`,
    [userId],
  );
  return result.rows.map(notificationFromRow);
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  db: NotificationQueryable = pool,
) {
  const result = await db.query(
    `UPDATE profile.notifications
        SET read_at=COALESCE(read_at,NOW())
      WHERE id=$1::uuid
        AND user_id=$2::uuid
      RETURNING id`,
    [notificationId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertInvitationRejectedNotification(
  invitationId: string,
  db: NotificationQueryable,
) {
  await db.query(
    `INSERT INTO profile.notifications(
       user_id,kind,entity_id,payload,expires_at
     )
     SELECT invitation.inviter_user_id,
            'game_invitation_rejected',
            invitation.id,
            jsonb_build_object(
              'handle',invitee.handle,
              'displayName',invitee.display_name,
              'roomCode',invitation.room_code_snapshot
            ),
            NOW() + INTERVAL '7 days'
       FROM game.room_invitations invitation
       JOIN profile.commanders invitee
         ON invitee.user_id=invitation.invitee_user_id
      WHERE invitation.id=$1::uuid`,
    [invitationId],
  );
}

export async function insertInvitationCancelledNotification(
  invitationId: string,
  userId: string,
  reason: string,
  db: NotificationQueryable,
) {
  await db.query(
    `INSERT INTO profile.notifications(
       user_id,kind,entity_id,payload,expires_at
     )
     SELECT $2::uuid,
            'game_invitation_cancelled',
            invitation.id,
            jsonb_build_object(
              'roomCode',invitation.room_code_snapshot,
              'reason',$3::text
            ),
            NOW() + INTERVAL '2 days'
       FROM game.room_invitations invitation
      WHERE invitation.id=$1::uuid`,
    [invitationId, userId, reason],
  );
}

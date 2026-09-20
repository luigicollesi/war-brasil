-- Persistent user notifications, invitation resolution metadata and waiting-room presence.
--
-- Up Migration

ALTER TABLE game.players
  ADD COLUMN IF NOT EXISTS lobby_last_seen_at TIMESTAMPTZ;

UPDATE game.players player
   SET lobby_last_seen_at=NOW()
  FROM game.rooms room
 WHERE room.id=player.room_id
   AND room.status='waiting'
   AND player.is_bot=FALSE
   AND player.lobby_last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS players_waiting_presence_idx
  ON game.players(lobby_last_seen_at,room_id)
  WHERE is_bot=FALSE AND lobby_last_seen_at IS NOT NULL;

ALTER TABLE game.room_invitations
  ADD COLUMN IF NOT EXISTS room_code_snapshot VARCHAR(6),
  ADD COLUMN IF NOT EXISTS resolved_reason VARCHAR(32);

UPDATE game.room_invitations invitation
   SET room_code_snapshot=room.code
  FROM game.rooms room
 WHERE room.id=invitation.room_id
   AND invitation.room_code_snapshot IS NULL;

ALTER TABLE game.room_invitations
  ALTER COLUMN room_code_snapshot SET NOT NULL;

ALTER TABLE game.room_invitations
  DROP CONSTRAINT IF EXISTS room_invitations_room_id_fkey;

ALTER TABLE game.room_invitations
  ALTER COLUMN room_id DROP NOT NULL;

ALTER TABLE game.room_invitations
  ADD CONSTRAINT room_invitations_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES game.rooms(id) ON DELETE SET NULL;

ALTER TABLE game.room_invitations
  DROP CONSTRAINT IF EXISTS room_invitations_resolved_reason_check;

ALTER TABLE game.room_invitations
  ADD CONSTRAINT room_invitations_resolved_reason_check
  CHECK (
    resolved_reason IS NULL OR resolved_reason IN (
      'accepted',
      'rejected',
      'cancelled',
      'expired',
      'room_started',
      'room_full',
      'room_deleted',
      'room_empty',
      'host_left'
    )
  );

CREATE TABLE IF NOT EXISTS profile.notifications (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  kind VARCHAR(48) NOT NULL
    CHECK (kind IN (
      'game_invitation_rejected',
      'game_invitation_cancelled'
    )),
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CONSTRAINT notifications_payload_object_check
    CHECK (jsonb_typeof(payload)='object')
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON profile.notifications(user_id,created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_expiry_idx
  ON profile.notifications(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN game.players.lobby_last_seen_at IS
  'Last heartbeat from a human seat while its room is still waiting.';
COMMENT ON COLUMN game.room_invitations.room_code_snapshot IS
  'Stable public room code kept even after the room is deleted.';
COMMENT ON COLUMN game.room_invitations.resolved_reason IS
  'Reason a pending invitation stopped being actionable.';
COMMENT ON TABLE profile.notifications IS
  'Persistent user-facing notifications recovered after reconnect or login.';

-- Down Migration
DROP TABLE IF EXISTS profile.notifications;

ALTER TABLE game.room_invitations
  DROP CONSTRAINT IF EXISTS room_invitations_resolved_reason_check;
ALTER TABLE game.room_invitations
  DROP COLUMN IF EXISTS resolved_reason;

ALTER TABLE game.room_invitations
  DROP CONSTRAINT IF EXISTS room_invitations_room_id_fkey;
DELETE FROM game.room_invitations WHERE room_id IS NULL;
ALTER TABLE game.room_invitations
  ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE game.room_invitations
  ADD CONSTRAINT room_invitations_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES game.rooms(id) ON DELETE CASCADE;
ALTER TABLE game.room_invitations
  DROP COLUMN IF EXISTS room_code_snapshot;

DROP INDEX IF EXISTS game.players_waiting_presence_idx;
ALTER TABLE game.players
  DROP COLUMN IF EXISTS lobby_last_seen_at;

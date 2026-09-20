-- Friend-only room invitations used by the public commander profile.
--
-- Up Migration

CREATE TABLE IF NOT EXISTS game.room_invitations (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  room_id UUID NOT NULL
    REFERENCES game.rooms(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  state VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','accepted','rejected','cancelled','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT room_invitations_distinct_users_check
    CHECK (inviter_user_id <> invitee_user_id),
  CONSTRAINT room_invitations_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT room_invitations_resolution_check
    CHECK (
      (state='pending' AND resolved_at IS NULL)
      OR (state<>'pending' AND resolved_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS room_invitations_pending_pair_uidx
  ON game.room_invitations(inviter_user_id,invitee_user_id)
  WHERE state='pending';

CREATE UNIQUE INDEX IF NOT EXISTS room_invitations_pending_room_invitee_uidx
  ON game.room_invitations(room_id,invitee_user_id)
  WHERE state='pending';

CREATE INDEX IF NOT EXISTS room_invitations_invitee_pending_idx
  ON game.room_invitations(invitee_user_id,state,created_at DESC);

CREATE INDEX IF NOT EXISTS room_invitations_inviter_pending_idx
  ON game.room_invitations(inviter_user_id,state,created_at DESC);

COMMENT ON TABLE game.room_invitations IS
  'Short-lived friend-only invitations into a waiting custom room.';
COMMENT ON COLUMN game.room_invitations.expires_at IS
  'Pending invitations become unusable after this timestamp even before opportunistic cleanup marks them expired.';

-- Down Migration
DROP TABLE IF EXISTS game.room_invitations;

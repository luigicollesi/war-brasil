-- PROFILE V3 persistent social graph.
-- Friendships are canonical unordered pairs; requests and blocks remain directional.
-- Presence/activity are intentionally not stored here.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS social;

CREATE TABLE IF NOT EXISTS social.friend_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  requester_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  state VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (requester_id <> recipient_id),
  CHECK (
    (state = 'pending' AND resolved_at IS NULL)
    OR (state <> 'pending' AND resolved_at IS NOT NULL)
  )
);

-- At most one pending request may exist for an unordered pair. This rejects
-- duplicates in the same direction and the mirrored A->B / B->A race.
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_uq
  ON social.friend_requests (
    LEAST(requester_id, recipient_id),
    GREATEST(requester_id, recipient_id)
  )
  WHERE state = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_recipient_pending_idx
  ON social.friend_requests (recipient_id, created_at DESC, id)
  WHERE state = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_requester_pending_idx
  ON social.friend_requests (requester_id, created_at DESC, id)
  WHERE state = 'pending';

CREATE TABLE IF NOT EXISTS social.friendships (
  user_a_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

-- The PK already supports lookups beginning with user_a_id; this index covers
-- the other side of the canonical pair without duplicating the PK index.
CREATE INDEX IF NOT EXISTS friendships_user_b_idx
  ON social.friendships (user_b_id, created_at DESC, user_a_id);

CREATE TABLE IF NOT EXISTS social.blocks (
  blocker_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocked_idx
  ON social.blocks (blocked_id, blocker_id);

COMMENT ON TABLE social.friend_requests IS
  'Directional friendship requests. Only one pending request may exist for an unordered account pair.';
COMMENT ON TABLE social.friendships IS
  'Persistent friendships stored once as canonical user_a_id < user_b_id pairs.';
COMMENT ON TABLE social.blocks IS
  'Directional account blocks. Service transactions remove friendships and pending requests when a block is created.';

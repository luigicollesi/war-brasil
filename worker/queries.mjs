export const DUE_AUTOMATION_SQL = `
  SELECT id::text room_id,
         revision,
         automation_kind,
         automation_due_at,
         GREATEST(
           0,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - automation_due_at)) * 1000)
         )::bigint due_lag_ms
  FROM game_rooms
  WHERE automation_due_at IS NOT NULL
    AND automation_due_at <= NOW()
  ORDER BY automation_due_at,id
  LIMIT $1
`;

export const CLAIM_DUE_AUTOMATION_SQL = `
  WITH due AS (
    SELECT id,
           automation_claimed_until
    FROM game_rooms
    WHERE automation_due_at IS NOT NULL
      AND automation_due_at <= NOW()
      AND (
        automation_claimed_until IS NULL
        OR automation_claimed_until <= NOW()
      )
    ORDER BY automation_due_at,id
    FOR UPDATE SKIP LOCKED
    LIMIT $1
  )
  UPDATE game_rooms room
  SET automation_claimed_by=$2,
      automation_claimed_until=NOW() + ($3 * INTERVAL '1 millisecond')
  FROM due
  WHERE room.id=due.id
  RETURNING room.id::text room_id,
            room.revision,
            room.automation_kind,
            room.automation_due_at,
            GREATEST(
              0,
              FLOOR(EXTRACT(EPOCH FROM (NOW() - room.automation_due_at)) * 1000)
            )::bigint due_lag_ms,
            (due.automation_claimed_until IS NOT NULL) recovered_expired_claim
`;

export const RELEASE_AUTOMATION_CLAIM_SQL = `
  UPDATE game_rooms
  SET automation_claimed_by=NULL,
      automation_claimed_until=NULL
  WHERE id=$1
    AND automation_claimed_by=$2
`;

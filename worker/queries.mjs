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

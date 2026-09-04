const PLAYER_SESSION_COOKIE = "war_brasil_player";

export function parseCookieHeader(header) {
  const values = new Map();
  if (!header) return values;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name || rawValue.length > 512) continue;
    try {
      values.set(name, decodeURIComponent(rawValue));
    } catch {
      values.set(name, rawValue);
    }
  }

  return values;
}

export async function readRealtimeIdentity(pool, roomId, cookieHeader) {
  const session = parseCookieHeader(cookieHeader).get(PLAYER_SESSION_COOKIE);
  if (!session || session.length > 128) return null;

  const result = await pool.query(
    `SELECT rp.id::text AS player_id, gr.revision
     FROM game_rooms gr
     JOIN room_players rp
       ON rp.room_id=gr.id
      AND rp.player_session=$2
     WHERE gr.id=$1`,
    [roomId, session],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    playerId: row.player_id,
    revision: Number(row.revision),
    session,
  };
}

export async function readRealtimeIdentityByPlayer(pool, roomId, playerId) {
  if (!/^\d+$/.test(roomId) || !/^\d+$/.test(playerId)) return null;

  const result = await pool.query(
    `SELECT rp.id::text AS player_id, gr.revision
     FROM game_rooms gr
     JOIN room_players rp
       ON rp.room_id=gr.id
      AND rp.id=$2
     WHERE gr.id=$1`,
    [roomId, playerId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    playerId: row.player_id,
    revision: Number(row.revision),
  };
}

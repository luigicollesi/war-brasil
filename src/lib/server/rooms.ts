import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/src/lib/db/pool";
import { isGameRuleset, type GameRuleset } from "@/src/lib/game-mode";
import { isPlayerColor, type LobbySnapshot, type PlayerColor } from "@/src/lib/lobby";
import { RoomError } from "@/src/lib/server/room-error";
import { startGame } from "@/src/lib/server/start-game-service";

export { RoomError } from "@/src/lib/server/room-error";

const ROOM_CODE_LENGTH = 6;
const MINIMUM_PLAYERS_TO_START = 2;
const DEFAULT_FACTION_NAME = "Nova facção";
const DEFAULT_COLORS: PlayerColor[] = [
  "forest",
  "ocean",
  "sun",
  "ruby",
  "violet",
  "orange",
];
const ROOM_SETTING_KEYS = new Set(["ruleset", "balancedDiceEnabled"]);

export type AuthenticatedPlayerIdentity = {
  userId: string;
  displayName: string;
  handle: string;
};

type RoomRow = {
  id: string;
  code: string;
  status: "waiting" | "order_roll" | "playing";
  created_at: Date;
  started_at: Date | null;
  ruleset: GameRuleset;
  balanced_dice_enabled: boolean;
};

type PlayerRow = {
  id: string;
  faction_name: string;
  display_name_snapshot: string | null;
  handle_snapshot: string | null;
  color: PlayerColor;
  is_ready: boolean;
  is_bot: boolean;
  is_me?: boolean;
};

type PlayerIdentityRow = {
  id: string;
  user_id: string | null;
};

type ReadinessRow = {
  player_count: number;
  ready_count: number;
};

type UpdateInput = Record<string, unknown>;

function normalizeRoomCode(value: unknown) {
  if (typeof value !== "string") return null;

  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

function normalizePlayerId(value: unknown) {
  if (typeof value !== "string") return null;
  return /^\d+$/.test(value) ? value : null;
}

function createRoomCode() {
  return randomUUID().replaceAll("-", "").slice(0, ROOM_CODE_LENGTH).toUpperCase();
}

function toSnapshot(room: RoomRow, players: PlayerRow[]): LobbySnapshot {
  const mappedPlayers = players.map((player) => {
    const displayName =
      player.is_bot
        ? player.faction_name
        : player.display_name_snapshot ?? player.faction_name;

    return {
      id: player.id,
      factionName: player.faction_name,
      displayName,
      handle: player.is_bot ? null : player.handle_snapshot,
      color: player.color,
      isReady: player.is_ready,
      isMe: Boolean(player.is_me),
      isBot: player.is_bot,
    };
  });
  const me = mappedPlayers.find((player) => player.isMe);

  if (!me) {
    throw new RoomError("Você não pertence a esta sala.", 403);
  }

  const roomManager = mappedPlayers.find((player) => !player.isBot);
  const canManageRoom = Boolean(roomManager?.isMe);

  return {
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      createdAt: room.created_at.toISOString(),
      startedAt: room.started_at?.toISOString() ?? null,
      ruleset: room.ruleset,
      balancedDiceEnabled: room.balanced_dice_enabled,
    },
    players: mappedPlayers,
    me,
    canManageBots: canManageRoom,
    canManageRoom,
  };
}

function isUniqueViolation(error: unknown, constraint: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint" in error &&
    error.code === "23505" &&
    error.constraint === constraint
  );
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findRoomForUpdate(client: PoolClient, code: string) {
  const result = await client.query<RoomRow>(
    `SELECT id,code,status,created_at,started_at,ruleset,balanced_dice_enabled
     FROM game.rooms
     WHERE code = $1
     FOR UPDATE`,
    [code],
  );
  const room = result.rows[0];

  if (!room) throw new RoomError("Sala não encontrada.", 404);
  return room;
}

async function availableColors(client: PoolClient, roomId: string) {
  const result = await client.query<{ color: PlayerColor }>(
    "SELECT color FROM game.players WHERE room_id = $1",
    [roomId],
  );
  const occupiedColors = new Set(result.rows.map((player) => player.color));
  return DEFAULT_COLORS.filter((candidate) => !occupiedColors.has(candidate));
}

async function findAvailableColor(client: PoolClient, roomId: string) {
  const colors = await availableColors(client, roomId);
  const color = colors[0];

  if (!color) throw new RoomError("Esta sala já está cheia.", 409);
  return color;
}

async function assertRoomManager(
  client: PoolClient,
  roomId: string,
  playerSession: string,
  errorMessage = "Apenas o criador da sala pode alterar as configurações.",
) {
  const manager = (
    await client.query<{ player_session: string }>(
      `SELECT player_session
       FROM game.players
       WHERE room_id = $1 AND is_bot = FALSE
       ORDER BY joined_at ASC, id ASC
       LIMIT 1`,
      [roomId],
    )
  ).rows[0];

  if (!manager || manager.player_session !== playerSession) {
    throw new RoomError(errorMessage, 403);
  }
}

async function resetHumanReadiness(client: PoolClient, roomId: string) {
  await client.query(
    `UPDATE game.players
     SET is_ready = FALSE
     WHERE room_id = $1 AND is_bot = FALSE`,
    [roomId],
  );
}

async function randomBotName(client: PoolClient, color: PlayerColor) {
  const names = (
    await client.query<{ name: string }>(
      `SELECT name
       FROM catalog.bot_names
       WHERE color = $1
       ORDER BY id`,
      [color],
    )
  ).rows;

  if (!names.length) {
    throw new RoomError(
      "O catálogo de facções de bots está incompleto para esta cor.",
      503,
    );
  }

  return names[randomInt(0, names.length)].name;
}

async function attachIdentityToExistingSeat(
  client: PoolClient,
  roomId: string,
  playerSession: string,
  identity: AuthenticatedPlayerIdentity,
) {
  const existingBySession = (
    await client.query<PlayerIdentityRow>(
      `SELECT id, user_id
       FROM game.players
       WHERE room_id = $1 AND player_session = $2
       FOR UPDATE`,
      [roomId, playerSession],
    )
  ).rows[0];

  if (existingBySession) {
    if (existingBySession.user_id && existingBySession.user_id !== identity.userId) {
      throw new RoomError("Este assento pertence a outra conta.", 403);
    }

    await client.query(
      `UPDATE game.players
       SET user_id = $1,
           faction_name = $2,
           display_name_snapshot = $2,
           handle_snapshot = $3,
           lobby_last_seen_at = NOW()
       WHERE id = $4`,
      [
        identity.userId,
        identity.displayName,
        identity.handle,
        existingBySession.id,
      ],
    );
    return true;
  }

  const existingByAccount = (
    await client.query<PlayerIdentityRow>(
      `SELECT id, user_id
       FROM game.players
       WHERE room_id = $1 AND user_id = $2 AND is_bot = FALSE
       FOR UPDATE`,
      [roomId, identity.userId],
    )
  ).rows[0];

  if (!existingByAccount) return false;

  await client.query(
    `UPDATE game.players
     SET player_session = $1,
         faction_name = $2,
         display_name_snapshot = $2,
         handle_snapshot = $3
     WHERE id = $4`,
    [
      playerSession,
      identity.displayName,
      identity.handle,
      existingByAccount.id,
    ],
  );
  return true;
}

export async function createRoom(
  playerSession: string,
  identity: AuthenticatedPlayerIdentity | null = null,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();

    try {
      return await withTransaction(async (client) => {
        const roomResult = await client.query<RoomRow>(
          `INSERT INTO game.rooms (code)
           VALUES ($1)
           RETURNING id,code,status,created_at,started_at,ruleset,balanced_dice_enabled`,
          [code],
        );
        const room = roomResult.rows[0];

        await client.query(
          `INSERT INTO game.players (
             room_id,
             player_session,
             faction_name,
             color,
             user_id,
             display_name_snapshot,
             handle_snapshot,
             lobby_last_seen_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            room.id,
            playerSession,
            identity?.displayName ?? DEFAULT_FACTION_NAME,
            DEFAULT_COLORS[0],
            identity?.userId ?? null,
            identity?.displayName ?? null,
            identity?.handle ?? null,
          ],
        );

        return room;
      });
    } catch (error) {
      if (isUniqueViolation(error, "rooms_code_key")) continue;
      throw error;
    }
  }

  throw new RoomError("Não foi possível gerar um código de sala. Tente novamente.", 503);
}

export async function joinRoomWithClient(
  client: PoolClient,
  codeValue: unknown,
  playerSession: string,
  identity: AuthenticatedPlayerIdentity | null = null,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const room = await findRoomForUpdate(client, code);
  if (room.status !== "waiting") {
    throw new RoomError("Esta partida já começou.", 409, {
      reason: "room_started",
    });
  }

  if (identity) {
    const reusedSeat = await attachIdentityToExistingSeat(
      client,
      room.id,
      playerSession,
      identity,
    );
    if (reusedSeat) return room;
  } else {
    const existingPlayer = await client.query<{ id: string }>(
      `SELECT id FROM game.players
       WHERE room_id = $1 AND player_session = $2
       FOR UPDATE`,
      [room.id, playerSession],
    );
    if (existingPlayer.rows[0]) {
      await client.query(
        `UPDATE game.players
            SET lobby_last_seen_at=NOW()
          WHERE id=$1`,
        [existingPlayer.rows[0].id],
      );
      return room;
    }
  }

  let color: PlayerColor;
  try {
    color = await findAvailableColor(client, room.id);
  } catch (error) {
    if (error instanceof RoomError && error.status === 409) {
      throw new RoomError("Esta sala já está cheia.", 409, {
        reason: "room_full",
      });
    }
    throw error;
  }

  await client.query(
    `INSERT INTO game.players (
       room_id,
       player_session,
       faction_name,
       color,
       user_id,
       display_name_snapshot,
       handle_snapshot,
       lobby_last_seen_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      room.id,
      playerSession,
      identity?.displayName ?? DEFAULT_FACTION_NAME,
      color,
      identity?.userId ?? null,
      identity?.displayName ?? null,
      identity?.handle ?? null,
    ],
  );

  return room;
}

export async function joinRoom(
  codeValue: unknown,
  playerSession: string,
  identity: AuthenticatedPlayerIdentity | null = null,
) {
  return withTransaction((client) =>
    joinRoomWithClient(client, codeValue, playerSession, identity),
  );
}

export async function addBotToRoom(codeValue: unknown, playerSession: string) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("Esta partida já começou.", 409);
    }

    await assertRoomManager(
      client,
      room.id,
      playerSession,
      "Apenas o criador da sala pode gerenciar bots.",
    );

    const colors = await availableColors(client, room.id);
    if (!colors.length) {
      throw new RoomError("Esta sala já está cheia.", 409);
    }

    const color = colors[randomInt(0, colors.length)];
    const factionName = await randomBotName(client, color);
    const botSession = randomUUID();
    const bot = (
      await client.query<{ id: string }>(
        `INSERT INTO game.players (
           room_id, player_session, faction_name, color, is_ready, is_bot
         )
         VALUES ($1, $2, $3, $4, TRUE, TRUE)
         RETURNING id`,
        [room.id, botSession, factionName, color],
      )
    ).rows[0];

    await resetHumanReadiness(client, room.id);

    return { id: bot.id };
  });
}

export async function removeBotFromRoom(
  codeValue: unknown,
  botIdValue: unknown,
  playerSession: string,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);
  const botId = normalizePlayerId(botIdValue);
  if (!botId) throw new RoomError("Bot inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("Esta partida já começou.", 409);
    }

    await assertRoomManager(
      client,
      room.id,
      playerSession,
      "Apenas o criador da sala pode gerenciar bots.",
    );

    const removed = await client.query<{ id: string }>(
      `DELETE FROM game.players
       WHERE room_id = $1 AND id = $2 AND is_bot = TRUE
       RETURNING id`,
      [room.id, botId],
    );

    if (!removed.rowCount) {
      throw new RoomError("Bot não encontrado nesta sala.", 404);
    }

    await resetHumanReadiness(client, room.id);

    return { id: removed.rows[0].id };
  });
}

export async function resolveGameRoomReference(referenceValue: unknown) {
  if (typeof referenceValue !== "string") {
    throw new RoomError("Partida inválida.", 422);
  }

  const reference = referenceValue.trim();
  if (/^[A-Z0-9]{6}$/i.test(reference)) {
    const result = await pool.query<{ id: string; code: string }>(
      `SELECT id::text,code
         FROM game.rooms
        WHERE code=$1`,
      [reference.toUpperCase()],
    );
    const room = result.rows[0];
    if (!room) throw new RoomError("Sala não encontrada.", 404);
    return room;
  }

  if (/^\d+$/.test(reference)) {
    const result = await pool.query<{ id: string; code: string }>(
      `SELECT id::text,code
         FROM game.rooms
        WHERE id=$1::bigint`,
      [reference],
    );
    const room = result.rows[0];
    if (!room) throw new RoomError("Sala não encontrada.", 404);
    return room;
  }

  throw new RoomError("Partida inválida.", 422);
}

export async function getLobbySnapshot(codeValue: unknown, playerSession: string) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const roomResult = await pool.query<RoomRow & { revision: number }>(
    `SELECT id,code,status,created_at,started_at,ruleset,balanced_dice_enabled,revision
     FROM game.rooms
     WHERE code = $1`,
    [code],
  );
  const room = roomResult.rows[0];
  if (!room) throw new RoomError("Sala não encontrada.", 404);

  const playerResult = await pool.query<PlayerRow>(
    `SELECT id, faction_name, display_name_snapshot, handle_snapshot,
            color, is_ready, is_bot,
            player_session = $2 AS is_me
     FROM game.players
     WHERE room_id = $1
     ORDER BY joined_at ASC, id ASC`,
    [room.id, playerSession],
  );

  return {
    snapshot: toSnapshot(room, playerResult.rows),
    revision: room.revision,
  };
}

export async function updateRoomSettings(
  codeValue: unknown,
  playerSession: string,
  input: UpdateInput,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const keys = Object.keys(input);
  if (keys.length === 0) {
    throw new RoomError("Nenhuma configuração foi informada.", 400);
  }
  for (const key of keys) {
    if (!ROOM_SETTING_KEYS.has(key)) {
      throw new RoomError("Configuração da sala desconhecida.", 422);
    }
  }

  const hasRuleset = Object.hasOwn(input, "ruleset");
  const hasBalancedDiceEnabled = Object.hasOwn(input, "balancedDiceEnabled");

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("As configurações só podem ser alteradas na sala de espera.", 409);
    }

    await assertRoomManager(client, room.id, playerSession);

    const rulesetValue = hasRuleset ? input.ruleset : room.ruleset;
    if (!isGameRuleset(rulesetValue)) {
      throw new RoomError("Modo de jogo inválido.", 422);
    }
    const ruleset = rulesetValue;

    const balancedDiceEnabled = hasBalancedDiceEnabled
      ? input.balancedDiceEnabled
      : room.balanced_dice_enabled;
    if (typeof balancedDiceEnabled !== "boolean") {
      throw new RoomError("Sorte balanceada deve ser ligada ou desligada.", 422);
    }

    const changed =
      ruleset !== room.ruleset ||
      balancedDiceEnabled !== room.balanced_dice_enabled;
    if (!changed) return room;

    await client.query(
      `UPDATE game.rooms
       SET ruleset=$2,balanced_dice_enabled=$3
       WHERE id=$1`,
      [room.id, ruleset, balancedDiceEnabled],
    );
    await resetHumanReadiness(client, room.id);

    room.ruleset = ruleset;
    room.balanced_dice_enabled = balancedDiceEnabled;
    return room;
  });
}

export async function heartbeatWaitingRoom(
  codeValue: unknown,
  playerSession: string,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      return { roomCode: room.code, active: false };
    }

    const updated = await client.query<{ id: string }>(
      `UPDATE game.players
          SET lobby_last_seen_at=NOW()
        WHERE room_id=$1
          AND player_session=$2
          AND is_bot=FALSE
        RETURNING id`,
      [room.id, playerSession],
    );
    if (!updated.rowCount) {
      throw new RoomError("Você não pertence a esta sala.", 403);
    }

    return { roomCode: room.code, active: true };
  });
}

async function deleteRoomIfNoHumans(client: PoolClient, roomId: string) {
  const humans = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
         FROM game.players
        WHERE room_id=$1
          AND is_bot=FALSE
     ) AS exists`,
    [roomId],
  );
  if (humans.rows[0]?.exists) return false;

  await client.query(
    `UPDATE game.room_invitations
        SET state='cancelled',
            resolved_reason='room_empty',
            resolved_at=NOW()
      WHERE room_id=$1
        AND state='pending'`,
    [roomId],
  );
  const deleted = await client.query(
    `DELETE FROM game.rooms
      WHERE id=$1
        AND status='waiting'`,
    [roomId],
  );
  return (deleted.rowCount ?? 0) > 0;
}

export async function leaveWaitingRoom(
  codeValue: unknown,
  playerSession: string,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError(
        "Não é possível abandonar o assento por esta rota após o início da partida.",
        409,
      );
    }

    const removed = await client.query<{
      id: string;
      user_id: string | null;
    }>(
      `DELETE FROM game.players
        WHERE room_id=$1
          AND player_session=$2
          AND is_bot=FALSE
        RETURNING id,user_id`,
      [room.id, playerSession],
    );
    if (!removed.rowCount) {
      throw new RoomError("Você não pertence a esta sala.", 404);
    }

    const removedUserId = removed.rows[0]?.user_id;
    if (removedUserId) {
      await client.query(
        `UPDATE game.room_invitations
            SET state='cancelled',
                resolved_reason='host_left',
                resolved_at=NOW()
          WHERE room_id=$1
            AND inviter_user_id=$2::uuid
            AND state='pending'`,
        [room.id, removedUserId],
      );
    }

    await resetHumanReadiness(client, room.id);
    const roomDeleted = await deleteRoomIfNoHumans(client, room.id);
    return { roomCode: room.code, roomDeleted };
  });
}

export async function cleanupStaleWaitingRoomSeats(
  staleAfterSeconds = 90,
  limit = 100,
) {
  if (!Number.isSafeInteger(staleAfterSeconds) || staleAfterSeconds < 30) {
    throw new Error("staleAfterSeconds inválido.");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("limit inválido.");
  }

  return withTransaction(async (client) => {
    const stale = await client.query<{
      player_id: string;
      room_id: string;
      user_id: string | null;
    }>(
      `SELECT player.id::text AS player_id,
              player.room_id::text AS room_id,
              player.user_id::text AS user_id
         FROM game.players player
         JOIN game.rooms room ON room.id=player.room_id
        WHERE room.status='waiting'
          AND player.is_bot=FALSE
          AND player.lobby_last_seen_at IS NOT NULL
          AND player.lobby_last_seen_at
              <= NOW() - ($1::int * INTERVAL '1 second')
        ORDER BY player.lobby_last_seen_at,player.id
        FOR UPDATE OF room,player SKIP LOCKED
        LIMIT $2`,
      [staleAfterSeconds, limit],
    );

    const affectedRooms = new Set<string>();
    let removedSeats = 0;
    for (const row of stale.rows) {
      const removed = await client.query(
        `DELETE FROM game.players
          WHERE id=$1::bigint
            AND lobby_last_seen_at
                <= NOW() - ($2::int * INTERVAL '1 second')`,
        [row.player_id, staleAfterSeconds],
      );
      if (!removed.rowCount) continue;

      removedSeats += 1;
      affectedRooms.add(row.room_id);

      if (row.user_id) {
        await client.query(
          `UPDATE game.room_invitations
              SET state='cancelled',
                  resolved_reason='host_left',
                  resolved_at=NOW()
            WHERE room_id=$1::bigint
              AND inviter_user_id=$2::uuid
              AND state='pending'`,
          [row.room_id, row.user_id],
        );
      }
    }

    let deletedRooms = 0;
    for (const roomId of affectedRooms) {
      await resetHumanReadiness(client, roomId);
      if (await deleteRoomIfNoHumans(client, roomId)) deletedRooms += 1;
    }

    return {
      removedSeats,
      affectedRooms: affectedRooms.size,
      deletedRooms,
    };
  });
}

export async function updateLobbyPlayer(
  codeValue: unknown,
  playerSession: string,
  input: UpdateInput,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const hasColor = Object.hasOwn(input, "color");
  const hasReady = Object.hasOwn(input, "isReady");
  if (Object.hasOwn(input, "factionName")) {
    throw new RoomError(
      "O nome exibido na sala é definido pelo perfil do comandante.",
      422,
    );
  }
  if (!hasColor && !hasReady) {
    throw new RoomError("Nenhuma alteração foi informada.", 400);
  }

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("Esta partida já começou.", 409);
    }

    const playerResult = await client.query<PlayerRow>(
      `SELECT id, faction_name, color, is_ready, is_bot
       FROM game.players
       WHERE room_id = $1 AND player_session = $2
       FOR UPDATE`,
      [room.id, playerSession],
    );
    const player = playerResult.rows[0];
    if (!player) throw new RoomError("Você não pertence a esta sala.", 403);

    const colorValue = hasColor ? input.color : player.color;
    if (!isPlayerColor(colorValue)) {
      throw new RoomError("Escolha uma cor disponível na paleta.", 422);
    }
    const color = colorValue;

    if (color !== player.color) {
      const colorResult = await client.query<{ id: string }>(
        `SELECT id FROM game.players
         WHERE room_id = $1 AND color = $2 AND id <> $3`,
        [room.id, color, player.id],
      );
      if (colorResult.rows[0]) {
        throw new RoomError("Esta cor já foi escolhida por outro jogador.", 409);
      }
    }

    const profileChanged = color !== player.color;
    const requestedReady = hasReady ? input.isReady : player.is_ready;
    if (typeof requestedReady !== "boolean") {
      throw new RoomError("O status de pronto deve ser verdadeiro ou falso.", 422);
    }
    const isReady = profileChanged ? false : requestedReady;

    await client.query(
      `UPDATE game.players
       SET color = $1, is_ready = $2
       WHERE id = $3`,
      [color, isReady, player.id],
    );

    const readinessResult = await client.query<ReadinessRow>(
      `SELECT COUNT(*)::int AS player_count,
              COUNT(*) FILTER (WHERE is_ready)::int AS ready_count
       FROM game.players
       WHERE room_id = $1`,
      [room.id],
    );
    const readiness = readinessResult.rows[0];

    if (
      readiness.player_count >= MINIMUM_PLAYERS_TO_START &&
      readiness.player_count === readiness.ready_count
    ) {
      await startGame(client, room.id);
      room.status = "order_roll";
    }

    return room;
  });
}

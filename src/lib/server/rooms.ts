import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/src/lib/db/pool";
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

type RoomRow = {
  id: string;
  code: string;
  status: "waiting" | "order_roll" | "playing";
  created_at: Date;
  started_at: Date | null;
};

type PlayerRow = {
  id: string;
  faction_name: string;
  color: PlayerColor;
  is_ready: boolean;
  is_bot: boolean;
  is_me?: boolean;
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

function validateFactionName(value: unknown) {
  if (typeof value !== "string") {
    throw new RoomError("Informe um nome de facção válido.", 422);
  }

  const name = value.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,31}$/u.test(name)) {
    throw new RoomError(
      "O nome da facção deve ter entre 2 e 32 caracteres válidos.",
      422,
    );
  }

  return name;
}

function toSnapshot(room: RoomRow, players: PlayerRow[]): LobbySnapshot {
  const mappedPlayers = players.map((player) => ({
    id: player.id,
    factionName: player.faction_name,
    color: player.color,
    isReady: player.is_ready,
    isMe: Boolean(player.is_me),
    isBot: player.is_bot,
  }));
  const me = mappedPlayers.find((player) => player.isMe);

  if (!me) {
    throw new RoomError("Você não pertence a esta sala.", 403);
  }

  const botManager = mappedPlayers.find((player) => !player.isBot);

  return {
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      createdAt: room.created_at.toISOString(),
      startedAt: room.started_at?.toISOString() ?? null,
    },
    players: mappedPlayers,
    me,
    canManageBots: Boolean(botManager?.isMe),
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
    `SELECT id, code, status, created_at, started_at
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

async function assertRoomBotManager(
  client: PoolClient,
  roomId: string,
  playerSession: string,
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
    throw new RoomError("Apenas o criador da sala pode gerenciar bots.", 403);
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

export async function createRoom(playerSession: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();

    try {
      return await withTransaction(async (client) => {
        const roomResult = await client.query<RoomRow>(
          `INSERT INTO game.rooms (code)
           VALUES ($1)
           RETURNING id, code, status, created_at, started_at`,
          [code],
        );
        const room = roomResult.rows[0];

        await client.query(
          `INSERT INTO game.players (room_id, player_session, faction_name, color)
           VALUES ($1, $2, $3, $4)`,
          [room.id, playerSession, DEFAULT_FACTION_NAME, DEFAULT_COLORS[0]],
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

export async function joinRoom(codeValue: unknown, playerSession: string) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("Esta partida já começou.", 409);
    }

    const existingPlayer = await client.query<{ id: string }>(
      `SELECT id FROM game.players
       WHERE room_id = $1 AND player_session = $2`,
      [room.id, playerSession],
    );

    if (existingPlayer.rows[0]) return room;

    const color = await findAvailableColor(client, room.id);
    await client.query(
      `INSERT INTO game.players (room_id, player_session, faction_name, color)
       VALUES ($1, $2, $3, $4)`,
      [room.id, playerSession, DEFAULT_FACTION_NAME, color],
    );

    return room;
  });
}

export async function addBotToRoom(codeValue: unknown, playerSession: string) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  return withTransaction(async (client) => {
    const room = await findRoomForUpdate(client, code);
    if (room.status !== "waiting") {
      throw new RoomError("Esta partida já começou.", 409);
    }

    await assertRoomBotManager(client, room.id, playerSession);

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

    await assertRoomBotManager(client, room.id, playerSession);

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

export async function getLobbySnapshot(codeValue: unknown, playerSession: string) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const roomResult = await pool.query<RoomRow>(
    `SELECT id, code, status, created_at, started_at
     FROM game.rooms
     WHERE code = $1`,
    [code],
  );
  const room = roomResult.rows[0];
  if (!room) throw new RoomError("Sala não encontrada.", 404);

  const playerResult = await pool.query<PlayerRow>(
    `SELECT id, faction_name, color, is_ready, is_bot,
            player_session = $2 AS is_me
     FROM game.players
     WHERE room_id = $1
     ORDER BY joined_at ASC, id ASC`,
    [room.id, playerSession],
  );

  return toSnapshot(room, playerResult.rows);
}

export async function updateLobbyPlayer(
  codeValue: unknown,
  playerSession: string,
  input: UpdateInput,
) {
  const code = normalizeRoomCode(codeValue);
  if (!code) throw new RoomError("Código de sala inválido.", 422);

  const hasFactionName = Object.hasOwn(input, "factionName");
  const hasColor = Object.hasOwn(input, "color");
  const hasReady = Object.hasOwn(input, "isReady");
  if (!hasFactionName && !hasColor && !hasReady) {
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

    const factionName = hasFactionName
      ? validateFactionName(input.factionName)
      : player.faction_name;
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

    const profileChanged =
      factionName !== player.faction_name || color !== player.color;
    const requestedReady = hasReady ? input.isReady : player.is_ready;
    if (typeof requestedReady !== "boolean") {
      throw new RoomError("O status de pronto deve ser verdadeiro ou falso.", 422);
    }
    const isReady = profileChanged ? false : requestedReady;

    await client.query(
      `UPDATE game.players
       SET faction_name = $1, color = $2, is_ready = $3
       WHERE id = $4`,
      [factionName, color, isReady, player.id],
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

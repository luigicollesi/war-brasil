import "server-only";

import type { PoolClient } from "pg";
import {
  DiceBalanceConfigurationError,
  type DiceBalanceAlgorithm,
  type DiceBalanceProfile,
} from "@/src/lib/shared/dice-balance";
import { validateDiceBalanceProfileExact } from "@/src/lib/shared/dice-profile-analysis";
import {
  BUILTIN_SAFE_UNIFORM_PROFILE_ID,
  SAFE_UNIFORM_DICE_PROFILE,
} from "@/src/lib/server/dice-balance-config";

type DiceBalanceProfileRow = {
  id: string;
  algorithm: string;
  alpha: number;
  pressure_cap: number;
  dead_zone: number;
  retention_per_round: number;
  max_group_shift: number;
  inner_tilt: number;
  min_face_probability: number;
  max_face_probability: number;
};

type CurrentMatchRow = {
  id: string;
  dice_balance_profile_snapshot: unknown;
};

type RoomMatchContext = {
  status: "waiting" | "order_roll" | "playing" | "finished";
  current_match_id: string | null;
};

export type LoadedMatchDiceBalance = {
  matchId: string;
  profile: DiceBalanceProfile;
};

type ResolvedStartProfile = {
  requestedProfileId: string | null;
  resolvedProfileId: string;
  source: "catalog" | "builtin_fallback";
  profile: DiceBalanceProfile;
};

function normalizeAlgorithm(value: string): DiceBalanceAlgorithm {
  if (value === "uniform" || value === "adaptive_halves") return value;
  throw new DiceBalanceConfigurationError(
    `Algoritmo de balanceamento de dados desconhecido: ${value}`,
  );
}

function mapProfile(row: DiceBalanceProfileRow): DiceBalanceProfile {
  return {
    algorithm: normalizeAlgorithm(row.algorithm),
    alpha: Number(row.alpha),
    pressureCap: Number(row.pressure_cap),
    deadZone: Number(row.dead_zone),
    retentionPerRound: Number(row.retention_per_round),
    maxGroupShift: Number(row.max_group_shift),
    innerTilt: Number(row.inner_tilt),
    minFaceProbability: Number(row.min_face_probability),
    maxFaceProbability: Number(row.max_face_probability),
  };
}

function parseProfileSnapshot(value: unknown): DiceBalanceProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DiceBalanceConfigurationError(
      "Snapshot do perfil de dados do match é inválido.",
    );
  }

  const snapshot = value as Record<string, unknown>;
  const profile: DiceBalanceProfile = {
    algorithm: normalizeAlgorithm(String(snapshot.algorithm ?? "")),
    alpha: Number(snapshot.alpha),
    pressureCap: Number(snapshot.pressureCap),
    deadZone: Number(snapshot.deadZone),
    retentionPerRound: Number(snapshot.retentionPerRound),
    maxGroupShift: Number(snapshot.maxGroupShift),
    innerTilt: Number(snapshot.innerTilt),
    minFaceProbability: Number(snapshot.minFaceProbability),
    maxFaceProbability: Number(snapshot.maxFaceProbability),
  };

  validateDiceBalanceProfileExact(profile);
  return profile;
}

async function loadCatalogProfile(
  client: PoolClient,
  profileId: string,
): Promise<DiceBalanceProfile> {
  const row = (
    await client.query<DiceBalanceProfileRow>(
      `SELECT id,algorithm,alpha,pressure_cap,dead_zone,retention_per_round,
              max_group_shift,inner_tilt,min_face_probability,max_face_probability
       FROM catalog.dice_balance_profiles
       WHERE id = $1`,
      [profileId],
    )
  ).rows[0];

  if (!row) {
    throw new DiceBalanceConfigurationError(
      `Perfil de balanceamento não encontrado: ${profileId}.`,
    );
  }

  const profile = mapProfile(row);
  validateDiceBalanceProfileExact(profile);
  return profile;
}

async function loadDefaultProfileId(client: PoolClient) {
  const row = (
    await client.query<{ default_profile_id: string }>(
      `SELECT default_profile_id
       FROM catalog.dice_balance_settings
       WHERE id = 1`,
    )
  ).rows[0];

  if (!row) {
    throw new DiceBalanceConfigurationError(
      "Configuração padrão de balanceamento de dados não encontrada.",
    );
  }
  return row.default_profile_id;
}

async function resolveProfileForNewMatch(
  client: PoolClient,
): Promise<ResolvedStartProfile> {
  let requestedProfileId: string | null = null;

  try {
    requestedProfileId = await loadDefaultProfileId(client);
    const profile = await loadCatalogProfile(client, requestedProfileId);
    return {
      requestedProfileId,
      resolvedProfileId: requestedProfileId,
      source: "catalog",
      profile,
    };
  } catch (error) {
    if (!(error instanceof DiceBalanceConfigurationError)) throw error;

    console.error(
      `[war-brasil] configuração de dados inválida no início do match; usando ${BUILTIN_SAFE_UNIFORM_PROFILE_ID}.`,
      error,
    );
    validateDiceBalanceProfileExact(SAFE_UNIFORM_DICE_PROFILE);
    return {
      requestedProfileId,
      resolvedProfileId: BUILTIN_SAFE_UNIFORM_PROFILE_ID,
      source: "builtin_fallback",
      profile: SAFE_UNIFORM_DICE_PROFILE,
    };
  }
}

async function lockRoomMatchContext(client: PoolClient, roomId: string) {
  const row = (
    await client.query<RoomMatchContext>(
      `SELECT status,current_match_id
       FROM game.rooms
       WHERE id = $1
       FOR UPDATE`,
      [roomId],
    )
  ).rows[0];

  if (!row) throw new Error(`Partida ${roomId} não encontrada.`);
  return row;
}

export async function initializeDiceBalanceForGame(
  client: PoolClient,
  roomId: string,
): Promise<LoadedMatchDiceBalance> {
  const room = await lockRoomMatchContext(client, roomId);
  if (room.status !== "waiting") {
    throw new Error(`A sala ${roomId} não está aguardando o início de uma partida.`);
  }
  if (room.current_match_id !== null) {
    throw new Error(
      `A sala ${roomId} já possui um match ativo (${room.current_match_id}).`,
    );
  }

  const selected = await resolveProfileForNewMatch(client);
  const sequence =
    (
      await client.query<{ next_sequence: number }>(
        `SELECT COALESCE(MAX(sequence), 0)::int + 1 AS next_sequence
         FROM game.matches
         WHERE room_id = $1`,
        [roomId],
      )
    ).rows[0]?.next_sequence ?? 1;

  const match = (
    await client.query<{ id: string }>(
      `INSERT INTO game.matches (
         room_id,sequence,requested_profile_id,resolved_profile_id,
         profile_source,dice_balance_profile_snapshot
       )
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id`,
      [
        roomId,
        sequence,
        selected.requestedProfileId,
        selected.resolvedProfileId,
        selected.source,
        JSON.stringify(selected.profile),
      ],
    )
  ).rows[0];

  if (!match) throw new Error(`Não foi possível criar o match da sala ${roomId}.`);

  await client.query(
    `INSERT INTO game.player_dice_states (match_id,player_id)
     SELECT $1,id
     FROM game.players
     WHERE room_id = $2`,
    [match.id, roomId],
  );

  await client.query(
    `UPDATE game.rooms
     SET current_match_id = $2
     WHERE id = $1`,
    [roomId, match.id],
  );

  return { matchId: match.id, profile: selected.profile };
}

export async function finishDiceBalanceMatchForRoom(
  client: PoolClient,
  roomId: string,
) {
  const room = await lockRoomMatchContext(client, roomId);
  if (room.current_match_id === null) return;

  await client.query(
    `UPDATE game.matches
     SET finished_at = COALESCE(finished_at, NOW())
     WHERE id = $1 AND room_id = $2`,
    [room.current_match_id, roomId],
  );
  await client.query(
    `UPDATE game.rooms
     SET current_match_id = NULL
     WHERE id = $1`,
    [roomId],
  );
}

export async function loadCurrentMatchDiceBalance(
  client: PoolClient,
  roomId: string,
): Promise<LoadedMatchDiceBalance> {
  const row = (
    await client.query<CurrentMatchRow>(
      `SELECT match.id,match.dice_balance_profile_snapshot
       FROM game.rooms room
       JOIN game.matches match ON match.id = room.current_match_id
       WHERE room.id = $1
         AND match.finished_at IS NULL`,
      [roomId],
    )
  ).rows[0];

  if (!row) {
    throw new Error(`A sala ${roomId} não possui match ativo para rolagem de dados.`);
  }

  return {
    matchId: row.id,
    profile: parseProfileSnapshot(row.dice_balance_profile_snapshot),
  };
}

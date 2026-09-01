import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";

type ObjectivePlayer = {
  id: string;
};

type ObjectiveRuleRow = {
  objective_rule_id: string;
  objective_id: string;
  params: Record<string, unknown>;
  target_selector: "random_other_player" | null;
};

type LegacyObjectiveRow = {
  id: string;
  target_selector: "random_other_player" | null;
};

type FallbackAssignmentRow = {
  player_id: string;
  fallback_objective_id: string;
};

type ObjectiveRuleSnapshotRow = {
  id: string;
  params: Record<string, unknown>;
};

export class ObjectiveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectiveConfigurationError";
  }
}

function shuffleInPlace<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function assertSupportedPlayerCount(playerCount: number) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) {
    throw new ObjectiveConfigurationError(
      `Objetivos só possuem regras para partidas de 2 a 6 jogadores; recebido ${playerCount}.`,
    );
  }
}

function isSchemaCompatibilityError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  // PostgreSQL: undefined_table / undefined_column.
  return error.code === "42P01" || error.code === "42703";
}

async function withSchemaCompatibilityFallback<T>(
  client: PoolClient,
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
) {
  await client.query("SAVEPOINT objective_rules_compatibility");

  try {
    const result = await primary();
    await client.query("RELEASE SAVEPOINT objective_rules_compatibility");
    return result;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT objective_rules_compatibility");
    await client.query("RELEASE SAVEPOINT objective_rules_compatibility");

    if (!isSchemaCompatibilityError(error)) throw error;
    return fallback();
  }
}

function targetPlayerFor(
  selector: "random_other_player" | null,
  player: ObjectivePlayer,
  players: readonly ObjectivePlayer[],
) {
  if (selector !== "random_other_player") return null;

  const otherPlayers = players.filter((candidate) => candidate.id !== player.id);
  return otherPlayers[randomInt(0, otherPlayers.length)].id;
}

async function assignBalancedObjectives(
  client: PoolClient,
  roomId: string,
  players: readonly ObjectivePlayer[],
) {
  const rules = (
    await client.query<ObjectiveRuleRow>(
      `SELECT r.id objective_rule_id,r.objective_id,r.params,o.target_selector
       FROM objective_rules r
       JOIN objectives o ON o.id=r.objective_id
       WHERE r.player_count=$1
         AND r.is_active=TRUE
         AND o.is_active=TRUE
       ORDER BY r.objective_id,r.revision DESC`,
      [players.length],
    )
  ).rows;

  if (rules.length < players.length) {
    throw new ObjectiveConfigurationError(
      `Não há objetivos balanceados suficientes para ${players.length} jogadores.`,
    );
  }

  const shuffledRules = [...rules];
  shuffleInPlace(shuffledRules);

  for (const [index, player] of players.entries()) {
    const rule = shuffledRules[index];
    const targetPlayerId = targetPlayerFor(
      rule.target_selector,
      player,
      players,
    );

    await client.query(
      `INSERT INTO game_player_objectives
         (room_id,player_id,objective_id,objective_rule_id,target_player_id,resolved_params)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        roomId,
        player.id,
        rule.objective_id,
        rule.objective_rule_id,
        targetPlayerId,
        JSON.stringify(rule.params),
      ],
    );
  }
}

async function assignLegacyObjectives(
  client: PoolClient,
  roomId: string,
  players: readonly ObjectivePlayer[],
) {
  const objectives = (
    await client.query<LegacyObjectiveRow>(
      `SELECT id,target_selector
       FROM objectives
       WHERE is_active=TRUE
       ORDER BY id`,
    )
  ).rows;

  if (objectives.length < players.length) {
    throw new ObjectiveConfigurationError(
      "Não há objetivos suficientes para iniciar a partida.",
    );
  }

  const shuffledObjectives = [...objectives];
  shuffleInPlace(shuffledObjectives);

  for (const [index, player] of players.entries()) {
    const objective = shuffledObjectives[index];
    const targetPlayerId = targetPlayerFor(
      objective.target_selector,
      player,
      players,
    );

    await client.query(
      `INSERT INTO game_player_objectives
         (room_id,player_id,objective_id,target_player_id)
       VALUES ($1,$2,$3,$4)`,
      [roomId, player.id, objective.id, targetPlayerId],
    );
  }
}

export async function assignObjectives(
  client: PoolClient,
  roomId: string,
  players: readonly ObjectivePlayer[],
) {
  assertSupportedPlayerCount(players.length);

  return withSchemaCompatibilityFallback(
    client,
    () => assignBalancedObjectives(client, roomId, players),
    () => assignLegacyObjectives(client, roomId, players),
  );
}

async function resolveBalancedFallbacks(
  client: PoolClient,
  roomId: string,
  targetPlayerId: string,
  playerCount: number,
) {
  const assignments = (
    await client.query<FallbackAssignmentRow>(
      `SELECT a.player_id,o.fallback_objective_id
       FROM game_player_objectives a
       JOIN objectives o ON o.id=a.objective_id
       WHERE a.room_id=$1
         AND a.target_player_id=$2
         AND o.fallback_objective_id IS NOT NULL`,
      [roomId, targetPlayerId],
    )
  ).rows;

  for (const assignment of assignments) {
    const rule = (
      await client.query<ObjectiveRuleSnapshotRow>(
        `SELECT id,params
         FROM objective_rules
         WHERE objective_id=$1 AND player_count=$2
         ORDER BY revision DESC
         LIMIT 1`,
        [assignment.fallback_objective_id, playerCount],
      )
    ).rows[0];

    if (!rule) {
      throw new ObjectiveConfigurationError(
        `Objetivo fallback ${assignment.fallback_objective_id} não possui regra para ${playerCount} jogadores.`,
      );
    }

    await client.query(
      `UPDATE game_player_objectives
       SET objective_id=$3,
           objective_rule_id=$4,
           target_player_id=NULL,
           resolved_params=$5::jsonb
       WHERE room_id=$1 AND player_id=$2`,
      [
        roomId,
        assignment.player_id,
        assignment.fallback_objective_id,
        rule.id,
        JSON.stringify(rule.params),
      ],
    );
  }

  return assignments.length;
}

async function resolveLegacyFallbacks(
  client: PoolClient,
  roomId: string,
  targetPlayerId: string,
) {
  const result = await client.query(
    `UPDATE game_player_objectives a
     SET objective_id=o.fallback_objective_id,target_player_id=NULL
     FROM objectives o
     WHERE a.objective_id=o.id
       AND a.room_id=$1
       AND a.target_player_id=$2
       AND o.fallback_objective_id IS NOT NULL`,
    [roomId, targetPlayerId],
  );

  return result.rowCount ?? 0;
}

export async function resolveObjectiveFallbacks(
  client: PoolClient,
  roomId: string,
  targetPlayerId: string,
) {
  const playerCount = Number(
    (
      await client.query<{ count: number }>(
        `SELECT COUNT(*)::int count
         FROM room_players
         WHERE room_id=$1`,
        [roomId],
      )
    ).rows[0]?.count ?? 0,
  );
  assertSupportedPlayerCount(playerCount);

  return withSchemaCompatibilityFallback(
    client,
    () => resolveBalancedFallbacks(client, roomId, targetPlayerId, playerCount),
    () => resolveLegacyFallbacks(client, roomId, targetPlayerId),
  );
}

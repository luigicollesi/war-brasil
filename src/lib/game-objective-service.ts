import "server-only";

import type { PoolClient } from "pg";
import {
  TERRITORY_METADATA,
  type Region,
} from "@/src/lib/game-config";
import { withObjectiveSchemaCompatibility } from "@/src/lib/objectives/objective-schema-compatibility";

type ObjectiveEvent =
  | "any"
  | "troops_changed"
  | "territory_control_changed";

type Objective = {
  id: string;
  type: string;
  name: string;
  description: string;
  params: Record<string, unknown>;
  target_player_id: string | null;
};

const REGION_TERRITORY_IDS: Record<Region, number[]> = {
  norte: [],
  nordeste: [],
  "centro-oeste": [],
  sudeste: [],
  sul: [],
};

for (const [territoryId, territory] of Object.entries(TERRITORY_METADATA)) {
  REGION_TERRITORY_IDS[territory.region].push(Number(territoryId));
}

function numericParam(objective: Objective, key: string) {
  const value = objective.params[key];
  return typeof value === "number" ? value : 0;
}

function positiveIntegerParam(objective: Objective, key: string) {
  const value = objective.params[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function requiredRegions(objective: Objective): Region[] | null {
  const value = objective.params.regions;
  if (!Array.isArray(value) || value.length === 0) return null;

  const regions = value.filter(
    (region): region is Region =>
      typeof region === "string" && region in REGION_TERRITORY_IDS,
  );

  return regions.length === value.length ? regions : null;
}

function eventCanAffectObjective(type: string, event: ObjectiveEvent) {
  if (event === "any" || event === "territory_control_changed") return true;

  // Reforços e bônus de cartas alteram apenas quantidade de tropas.
  // Entre os objetivos legados, somente fortificação pode ser concluída assim.
  return type === "fortification";
}

async function loadObjective(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  return withObjectiveSchemaCompatibility(
    client,
    async () =>
      (
        await client.query<Objective>(
          `SELECT o.id,o.type,o.name,o.description,
                  COALESCE(
                    CASE WHEN r.objective_id=a.objective_id THEN a.resolved_params END,
                    o.params
                  ) params,
                  a.target_player_id
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           LEFT JOIN objective_rules r ON r.id=a.objective_rule_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, playerId],
        )
      ).rows[0] ?? null,
    async () =>
      (
        await client.query<Objective>(
          `SELECT o.id,o.type,o.name,o.description,o.params,a.target_player_id
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, playerId],
        )
      ).rows[0] ?? null,
  );
}

async function ownedTerritoryCount(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const row = (
    await client.query<{ count: number }>(
      `SELECT COUNT(*)::int count
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2`,
      [roomId, playerId],
    )
  ).rows[0];

  return row?.count ?? 0;
}

async function fortificationTerritoryCount(
  client: PoolClient,
  roomId: string,
  playerId: string,
  minimumTroops: number,
) {
  const row = (
    await client.query<{ count: number }>(
      `SELECT COUNT(*)::int count
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2 AND troops >= $3`,
      [roomId, playerId, minimumTroops],
    )
  ).rows[0];

  return row?.count ?? 0;
}

async function playerHasTerritory(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const row = (
    await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM game_territories
         WHERE room_id=$1 AND owner_player_id=$2
       ) exists`,
      [roomId, playerId],
    )
  ).rows[0];

  return Boolean(row?.exists);
}

async function ownedTerritoryIds(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  return (
    await client.query<{ territory_id: number }>(
      `SELECT territory_id
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2`,
      [roomId, playerId],
    )
  ).rows.map((row) => row.territory_id);
}

export async function objectiveWon(
  client: PoolClient,
  roomId: string,
  playerId: string,
  event: ObjectiveEvent = "any",
) {
  const objective = await loadObjective(client, roomId, playerId);

  if (!objective || !eventCanAffectObjective(objective.type, event)) {
    return false;
  }

  let won = false;

  if (objective.type === "territories") {
    const requiredTerritories = positiveIntegerParam(objective, "territories");
    won =
      requiredTerritories !== null &&
      (await ownedTerritoryCount(client, roomId, playerId)) >=
        requiredTerritories;
  } else if (objective.type === "fortification") {
    const requiredTerritories = positiveIntegerParam(objective, "territories");
    const minimumTroops = positiveIntegerParam(objective, "minTroops");
    won =
      requiredTerritories !== null &&
      minimumTroops !== null &&
      (await fortificationTerritoryCount(
        client,
        roomId,
        playerId,
        minimumTroops,
      )) >= requiredTerritories;
  } else if (
    objective.type === "elimination" ||
    objective.type === "elimination_plus"
  ) {
    won =
      Boolean(objective.target_player_id) &&
      !(await playerHasTerritory(
        client,
        roomId,
        objective.target_player_id!,
      ));

    const hasTerritoryFloor =
      Object.prototype.hasOwnProperty.call(objective.params, "territories") ||
      objective.type === "elimination_plus";
    if (won && hasTerritoryFloor) {
      const minimumTerritories = positiveIntegerParam(objective, "territories");
      won =
        minimumTerritories !== null &&
        (await ownedTerritoryCount(client, roomId, playerId)) >=
          minimumTerritories;
    }
  } else {
    const ownedIds = new Set(
      await ownedTerritoryIds(client, roomId, playerId),
    );
    const fullRegions = (Object.keys(REGION_TERRITORY_IDS) as Region[]).filter(
      (region) =>
        REGION_TERRITORY_IDS[region].every((territoryId) =>
          ownedIds.has(territoryId),
        ),
    );
    const required = requiredRegions(objective);

    if (
      (objective.type === "regions" || objective.type === "region_plus") &&
      required === null
    ) {
      won = false;
    } else {
      const requiredForEvaluation = required ?? [];
      won = requiredForEvaluation.every((region) =>
        fullRegions.includes(region),
      );

      const extra = numericParam(objective, "additionalAnyRegion");
      if (extra) {
        won &&=
          fullRegions.filter((region) => !requiredForEvaluation.includes(region))
            .length >= extra;
      }

      if (objective.type === "region_plus") {
        const minimumTerritories = positiveIntegerParam(
          objective,
          "territories",
        );
        won &&=
          minimumTerritories !== null && ownedIds.size >= minimumTerritories;
      } else if (
        objective.type === "presence" ||
        objective.type === "network"
      ) {
        won &&= ownedIds.size >= (numericParam(objective, "territories") || 1);
      }
    }
  }

  if (won) {
    await client.query(
      `UPDATE game_rooms
       SET status='finished',phase='finished',winner_player_id=$2
       WHERE id=$1`,
      [roomId, playerId],
    );
  }

  return won;
}

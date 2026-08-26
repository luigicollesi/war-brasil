import "server-only";

import type { PoolClient } from "pg";
import {
  TERRITORY_METADATA,
  type Region,
} from "@/src/lib/game-config";

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

function requiredRegions(objective: Objective): Region[] {
  const value = objective.params.regions;
  if (!Array.isArray(value)) return [];

  return value.filter(
    (region): region is Region =>
      typeof region === "string" && region in REGION_TERRITORY_IDS,
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

async function playerHasTerritories(
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
  ).rows.map((territory) => territory.territory_id);
}

function completedRegions(ownedIds: Set<number>) {
  return (Object.keys(REGION_TERRITORY_IDS) as Region[]).filter((region) =>
    REGION_TERRITORY_IDS[region].every((territoryId) =>
      ownedIds.has(territoryId),
    ),
  );
}

async function evaluateObjective(
  client: PoolClient,
  roomId: string,
  playerId: string,
  objective: Objective,
) {
  if (objective.type === "territories") {
    return (
      (await ownedTerritoryCount(client, roomId, playerId)) >=
      numericParam(objective, "territories")
    );
  }

  if (objective.type === "fortification") {
    return (
      (await fortificationTerritoryCount(
        client,
        roomId,
        playerId,
        numericParam(objective, "minTroops"),
      )) >= numericParam(objective, "territories")
    );
  }

  if (
    objective.type === "elimination" ||
    objective.type === "elimination_plus"
  ) {
    if (!objective.target_player_id) return false;

    const targetStillOwnsTerritory = await playerHasTerritories(
      client,
      roomId,
      objective.target_player_id,
    );
    if (targetStillOwnsTerritory) return false;

    return objective.type === "elimination"
      ? true
      : (await ownedTerritoryCount(client, roomId, playerId)) >=
          (numericParam(objective, "territories") || 1);
  }

  const ownedIds = new Set(
    await ownedTerritoryIds(client, roomId, playerId),
  );
  const fullRegions = completedRegions(ownedIds);
  const required = requiredRegions(objective);
  let won = required.every((region) => fullRegions.includes(region));

  const extra = numericParam(objective, "additionalAnyRegion");
  if (extra) {
    won &&=
      fullRegions.filter((region) => !required.includes(region)).length >= extra;
  }

  if (objective.type === "presence" || objective.type === "network") {
    won &&= ownedIds.size >= (numericParam(objective, "territories") || 1);
  }

  return won;
}

export async function objectiveWon(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const objective = (
    await client.query<Objective>(
      `SELECT o.id,o.type,o.name,o.description,o.params,a.target_player_id
       FROM game_player_objectives a
       JOIN objectives o ON o.id=a.objective_id
       WHERE a.room_id=$1 AND a.player_id=$2`,
      [roomId, playerId],
    )
  ).rows[0];

  if (!objective) return false;

  const won = await evaluateObjective(client, roomId, playerId, objective);

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

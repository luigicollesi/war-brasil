import "server-only";

import type { PoolClient } from "pg";
import {
  TERRITORY_METADATA,
  type Region,
} from "@/src/lib/game-config";

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

function requiredRegions(objective: Objective): Region[] {
  const value = objective.params.regions;
  if (!Array.isArray(value)) return [];

  return value.filter(
    (region): region is Region =>
      typeof region === "string" && region in REGION_TERRITORY_IDS,
  );
}

function eventCanAffectObjective(type: string, event: ObjectiveEvent) {
  if (event === "any" || event === "territory_control_changed") return true;

  // Reforços e bônus de cartas alteram apenas quantidade de tropas.
  // Entre os objetivos atuais, somente fortificação pode ser concluída assim.
  return type === "fortification";
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
  const objective = (
    await client.query<Objective>(
      `SELECT o.id,o.type,o.name,o.description,o.params,a.target_player_id
       FROM game_player_objectives a
       JOIN objectives o ON o.id=a.objective_id
       WHERE a.room_id=$1 AND a.player_id=$2`,
      [roomId, playerId],
    )
  ).rows[0];

  if (!objective || !eventCanAffectObjective(objective.type, event)) {
    return false;
  }

  let won = false;

  if (objective.type === "territories") {
    won =
      (await ownedTerritoryCount(client, roomId, playerId)) >=
      numericParam(objective, "territories");
  } else if (objective.type === "fortification") {
    won =
      (await fortificationTerritoryCount(
        client,
        roomId,
        playerId,
        numericParam(objective, "minTroops"),
      )) >= numericParam(objective, "territories");
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

    if (won && objective.type === "elimination_plus") {
      won =
        (await ownedTerritoryCount(client, roomId, playerId)) >=
        (numericParam(objective, "territories") || 1);
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
    won = required.every((region) => fullRegions.includes(region));

    const extra = numericParam(objective, "additionalAnyRegion");
    if (extra) {
      won &&=
        fullRegions.filter((region) => !required.includes(region)).length >= extra;
    }

    if (objective.type === "presence" || objective.type === "network") {
      won &&= ownedIds.size >= (numericParam(objective, "territories") || 1);
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

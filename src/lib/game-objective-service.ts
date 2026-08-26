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

type ObjectiveTerritory = {
  territory_id: number;
  troops: number;
  owner_player_id: string;
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

  const territories = (
    await client.query<ObjectiveTerritory>(
      `SELECT territory_id,troops,owner_player_id
       FROM game_territories
       WHERE room_id=$1`,
      [roomId],
    )
  ).rows;

  const owned = territories.filter(
    (territory) => territory.owner_player_id === playerId,
  );
  const ownedIds = new Set(owned.map((territory) => territory.territory_id));
  const fullRegions = (Object.keys(REGION_TERRITORY_IDS) as Region[]).filter(
    (region) =>
      REGION_TERRITORY_IDS[region].every((territoryId) =>
        ownedIds.has(territoryId),
      ),
  );

  let won = false;

  if (objective.type === "territories") {
    won = owned.length >= numericParam(objective, "territories");
  } else if (objective.type === "fortification") {
    won =
      owned.filter(
        (territory) =>
          territory.troops >= numericParam(objective, "minTroops"),
      ).length >= numericParam(objective, "territories");
  } else if (
    objective.type === "elimination" ||
    objective.type === "elimination_plus"
  ) {
    won =
      Boolean(objective.target_player_id) &&
      !territories.some(
        (territory) =>
          territory.owner_player_id === objective.target_player_id,
      );

    if (won && objective.type === "elimination_plus") {
      won = owned.length >= (numericParam(objective, "territories") || 1);
    }
  } else {
    const required = requiredRegions(objective);
    won = required.every((region) => fullRegions.includes(region));

    const extra = numericParam(objective, "additionalAnyRegion");
    if (extra) {
      won &&=
        fullRegions.filter((region) => !required.includes(region)).length >= extra;
    }

    if (objective.type === "presence" || objective.type === "network") {
      won &&= owned.length >= (numericParam(objective, "territories") || 1);
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

import "server-only";

import type { PoolClient } from "pg";
import {
  EventConfigurationError,
  type ResolvedEventEffect,
} from "./event-types";

type UpdatedTerritoryRow = {
  territory_id: number;
  troops: number;
  moved_in_turn: number;
};

export type EventTerritoryUpdate = {
  territoryId: number;
  troops: number;
  movedInTurn: number;
};

function mapUpdate(row: UpdatedTerritoryRow): EventTerritoryUpdate {
  return {
    territoryId: row.territory_id,
    troops: row.troops,
    movedInTurn: row.moved_in_turn,
  };
}

async function applyTroopEffect(
  client: PoolClient,
  roomId: string,
  effect: Extract<
    ResolvedEventEffect,
    { type: "ADD_TROOPS" | "REMOVE_TROOPS" }
  >,
) {
  const query =
    effect.type === "ADD_TROOPS"
      ? `UPDATE game_territories
         SET troops=troops+$3
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         RETURNING territory_id,troops,moved_in_turn`
      : `UPDATE game_territories
         SET troops=GREATEST(1,troops-$3),
             moved_in_turn=LEAST(moved_in_turn,GREATEST(1,troops-$3))
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         RETURNING territory_id,troops,moved_in_turn`;

  const rows = (
    await client.query<UpdatedTerritoryRow>(query, [
      roomId,
      effect.territories,
      effect.amount,
    ])
  ).rows;

  if (rows.length !== effect.territories.length) {
    throw new EventConfigurationError(
      `${effect.type} referencia território que não existe na partida.`,
    );
  }

  return rows.map(mapUpdate);
}

export async function applyPermanentEventEffects(
  client: PoolClient,
  roomId: string,
  resolvedEffects: readonly ResolvedEventEffect[],
): Promise<EventTerritoryUpdate[]> {
  const latestByTerritory = new Map<number, EventTerritoryUpdate>();

  for (const effect of resolvedEffects) {
    if (effect.type !== "ADD_TROOPS" && effect.type !== "REMOVE_TROOPS") {
      continue;
    }

    const updates = await applyTroopEffect(client, roomId, effect);
    for (const update of updates) {
      latestByTerritory.set(update.territoryId, update);
    }
  }

  return Array.from(latestByTerritory.values()).sort(
    (left, right) => left.territoryId - right.territoryId,
  );
}

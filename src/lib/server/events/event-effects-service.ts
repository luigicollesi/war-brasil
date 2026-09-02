import "server-only";

import type { PoolClient } from "pg";
import { MIN_TERRITORY_TROOPS } from "@/src/lib/game-rules";
import {
  EventConfigurationError,
  type AppliedEventTroopChange,
  type ResolvedEventEffect,
} from "./event-types";

type TerritoryStateRow = {
  territory_id: number;
  troops: number;
  moved_in_turn: number;
};

export type EventTerritoryUpdate = {
  territoryId: number;
  troops: number;
  movedInTurn: number;
};

export type EventEffectsApplication = {
  territoryUpdates: EventTerritoryUpdate[];
  appliedTroopChanges: AppliedEventTroopChange[];
};

function mapUpdate(row: TerritoryStateRow): EventTerritoryUpdate {
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
): Promise<{
  updates: EventTerritoryUpdate[];
  changes: AppliedEventTroopChange[];
}> {
  const beforeRows = (
    await client.query<TerritoryStateRow>(
      `SELECT territory_id,troops,moved_in_turn
       FROM game_territories
       WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
       ORDER BY territory_id
       FOR UPDATE`,
      [roomId, effect.territories],
    )
  ).rows;

  if (beforeRows.length !== effect.territories.length) {
    throw new EventConfigurationError(
      `${effect.type} referencia território que não existe na partida.`,
    );
  }

  const query =
    effect.type === "ADD_TROOPS"
      ? `UPDATE game_territories
         SET troops=troops+$3
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         RETURNING territory_id,troops,moved_in_turn`
      : `UPDATE game_territories
         SET troops=GREATEST(${MIN_TERRITORY_TROOPS},troops-$3),
             moved_in_turn=LEAST(moved_in_turn,GREATEST(${MIN_TERRITORY_TROOPS},troops-$3))
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         RETURNING territory_id,troops,moved_in_turn`;

  const afterRows = (
    await client.query<TerritoryStateRow>(query, [
      roomId,
      effect.territories,
      effect.amount,
    ])
  ).rows;

  if (afterRows.length !== effect.territories.length) {
    throw new EventConfigurationError(
      `${effect.type} não conseguiu atualizar todos os territórios configurados.`,
    );
  }

  const beforeByTerritory = new Map(
    beforeRows.map((row) => [row.territory_id, row]),
  );
  const sortedAfter = [...afterRows].sort(
    (left, right) => left.territory_id - right.territory_id,
  );

  return {
    updates: sortedAfter.map(mapUpdate),
    changes: sortedAfter.map((after) => {
      const before = beforeByTerritory.get(after.territory_id);
      if (!before) {
        throw new EventConfigurationError(
          `${effect.type} perdeu o estado anterior do território ${after.territory_id}.`,
        );
      }

      return {
        type: effect.type,
        territoryId: after.territory_id,
        beforeTroops: before.troops,
        afterTroops: after.troops,
        delta: after.troops - before.troops,
      };
    }),
  };
}

export async function applyPermanentEventEffectsWithChanges(
  client: PoolClient,
  roomId: string,
  resolvedEffects: readonly ResolvedEventEffect[],
): Promise<EventEffectsApplication> {
  const latestByTerritory = new Map<number, EventTerritoryUpdate>();
  const appliedTroopChanges: AppliedEventTroopChange[] = [];

  for (const effect of resolvedEffects) {
    if (effect.type !== "ADD_TROOPS" && effect.type !== "REMOVE_TROOPS") {
      continue;
    }

    const application = await applyTroopEffect(client, roomId, effect);
    for (const update of application.updates) {
      latestByTerritory.set(update.territoryId, update);
    }
    appliedTroopChanges.push(...application.changes);
  }

  return {
    territoryUpdates: Array.from(latestByTerritory.values()).sort(
      (left, right) => left.territoryId - right.territoryId,
    ),
    appliedTroopChanges,
  };
}

export async function applyPermanentEventEffects(
  client: PoolClient,
  roomId: string,
  resolvedEffects: readonly ResolvedEventEffect[],
): Promise<EventTerritoryUpdate[]> {
  return (
    await applyPermanentEventEffectsWithChanges(
      client,
      roomId,
      resolvedEffects,
    )
  ).territoryUpdates;
}

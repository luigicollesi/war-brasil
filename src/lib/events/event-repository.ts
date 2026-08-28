import "server-only";

import type { PoolClient } from "pg";
import {
  parseAppliedEventTroopChanges,
  parseEventEffects,
  parseResolvedEventEffects,
  type AppliedEventTroopChange,
  type EventConnection,
  type GameEvent,
  type GameRoundEvent,
  type GameRoundEventDetails,
  type ResolvedEventEffect,
} from "./event-types";

type EventRow = {
  id: number;
  name: string;
  description: string;
  effects: unknown;
};

type EventConnectionRow = {
  from_event: number;
  to_event: number;
  weight: number;
};

type GameRoundEventRow = {
  room_id: string;
  round_number: number;
  event_id: number;
  resolved_effects: unknown;
  applied_troop_changes: unknown;
  activated_at: Date;
};

type GameRoundEventDetailsRow = GameRoundEventRow & {
  name: string;
  description: string;
};

function mapEvent(row: EventRow): GameEvent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    effects: parseEventEffects(row.effects),
  };
}

function mapConnection(row: EventConnectionRow): EventConnection {
  return {
    fromEvent: row.from_event,
    toEvent: row.to_event,
    weight: row.weight,
  };
}

function mapRoundEvent(row: GameRoundEventRow): GameRoundEvent {
  return {
    roomId: row.room_id,
    roundNumber: row.round_number,
    eventId: row.event_id,
    resolvedEffects: parseResolvedEventEffects(row.resolved_effects),
    appliedTroopChanges: parseAppliedEventTroopChanges(
      row.applied_troop_changes,
    ),
    activatedAt: row.activated_at,
  };
}

function mapRoundEventDetails(
  row: GameRoundEventDetailsRow,
): GameRoundEventDetails {
  return {
    ...mapRoundEvent(row),
    name: row.name,
    description: row.description,
  };
}

export async function getEvent(
  client: PoolClient,
  eventId: number,
): Promise<GameEvent | null> {
  const row = (
    await client.query<EventRow>(
      `SELECT id,name,description,effects
       FROM events
       WHERE id=$1`,
      [eventId],
    )
  ).rows[0];

  return row ? mapEvent(row) : null;
}

export async function getEventCatalogSnapshot(client: PoolClient): Promise<{
  eventIds: number[];
  connections: EventConnection[];
}> {
  const eventRows = (
    await client.query<{ id: number }>(
      `SELECT id
       FROM events
       ORDER BY id`,
    )
  ).rows;

  const connectionRows = (
    await client.query<EventConnectionRow>(
      `SELECT from_event,to_event,weight
       FROM event_connections
       ORDER BY from_event,to_event`,
    )
  ).rows;

  return {
    eventIds: eventRows.map((row) => row.id),
    connections: connectionRows.map(mapConnection),
  };
}

export async function getOutgoingEventConnections(
  client: PoolClient,
  eventId: number,
): Promise<EventConnection[]> {
  const rows = (
    await client.query<EventConnectionRow>(
      `SELECT from_event,to_event,weight
       FROM event_connections
       WHERE from_event=$1
       ORDER BY to_event`,
      [eventId],
    )
  ).rows;

  return rows.map(mapConnection);
}

export async function getRecentRoomEventIds(
  client: PoolClient,
  roomId: string,
  limit: number,
): Promise<number[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("O limite do histórico de eventos precisa ser positivo.");
  }

  const rows = (
    await client.query<{ event_id: number }>(
      `SELECT event_id
       FROM game_round_events
       WHERE room_id=$1
       ORDER BY round_number DESC
       LIMIT $2`,
      [roomId, limit],
    )
  ).rows;

  return rows.map((row) => row.event_id);
}

export async function getRoomRoundEvent(
  client: PoolClient,
  roomId: string,
  roundNumber: number,
): Promise<GameRoundEvent | null> {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new RangeError("A rodada do evento precisa ser um inteiro positivo.");
  }

  const row = (
    await client.query<GameRoundEventRow>(
      `SELECT room_id,round_number,event_id,resolved_effects,
              applied_troop_changes,activated_at
       FROM game_round_events
       WHERE room_id=$1 AND round_number=$2`,
      [roomId, roundNumber],
    )
  ).rows[0];

  return row ? mapRoundEvent(row) : null;
}

export async function getRoomRoundEventDetails(
  client: PoolClient,
  roomId: string,
  roundNumber: number,
): Promise<GameRoundEventDetails | null> {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new RangeError("A rodada do evento precisa ser um inteiro positivo.");
  }

  const row = (
    await client.query<GameRoundEventDetailsRow>(
      `SELECT gre.room_id,gre.round_number,gre.event_id,gre.resolved_effects,
              gre.applied_troop_changes,gre.activated_at,e.name,e.description
       FROM game_round_events gre
       JOIN events e ON e.id=gre.event_id
       WHERE gre.room_id=$1 AND gre.round_number=$2`,
      [roomId, roundNumber],
    )
  ).rows[0];

  return row ? mapRoundEventDetails(row) : null;
}

export async function getLatestRoomEvent(
  client: PoolClient,
  roomId: string,
): Promise<GameRoundEvent | null> {
  const row = (
    await client.query<GameRoundEventRow>(
      `SELECT room_id,round_number,event_id,resolved_effects,
              applied_troop_changes,activated_at
       FROM game_round_events
       WHERE room_id=$1
       ORDER BY round_number DESC
       LIMIT 1`,
      [roomId],
    )
  ).rows[0];

  return row ? mapRoundEvent(row) : null;
}

export async function recordRoundEvent(
  client: PoolClient,
  input: {
    roomId: string;
    roundNumber: number;
    eventId: number;
    resolvedEffects?: ResolvedEventEffect[];
    appliedTroopChanges?: AppliedEventTroopChange[];
  },
): Promise<GameRoundEvent> {
  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    throw new RangeError("A rodada do evento precisa ser um inteiro positivo.");
  }

  const row = (
    await client.query<GameRoundEventRow>(
      `INSERT INTO game_round_events
         (room_id,round_number,event_id,resolved_effects,applied_troop_changes)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
       RETURNING room_id,round_number,event_id,resolved_effects,
                 applied_troop_changes,activated_at`,
      [
        input.roomId,
        input.roundNumber,
        input.eventId,
        JSON.stringify(input.resolvedEffects ?? []),
        JSON.stringify(input.appliedTroopChanges ?? []),
      ],
    )
  ).rows[0];

  if (!row) {
    throw new Error("Não foi possível registrar o evento da rodada.");
  }
  return mapRoundEvent(row);
}

export async function setRoundEventAppliedTroopChanges(
  client: PoolClient,
  input: {
    roomId: string;
    roundNumber: number;
    appliedTroopChanges: AppliedEventTroopChange[];
  },
): Promise<GameRoundEvent> {
  const row = (
    await client.query<GameRoundEventRow>(
      `UPDATE game_round_events
       SET applied_troop_changes=$3::jsonb
       WHERE room_id=$1 AND round_number=$2
       RETURNING room_id,round_number,event_id,resolved_effects,
                 applied_troop_changes,activated_at`,
      [
        input.roomId,
        input.roundNumber,
        JSON.stringify(input.appliedTroopChanges),
      ],
    )
  ).rows[0];

  if (!row) {
    throw new Event(
      `Evento da rodada ${input.roundNumber} não foi encontrado para atualização.`,
    );
  }

  return mapRoundEvent(row);
}

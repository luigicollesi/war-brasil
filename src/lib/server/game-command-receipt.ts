import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { canonicalGameCommandRequest } from "@/src/lib/shared/game-command-canonical";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import type { GameCommandResult } from "@/src/lib/game-revision";
import { RoomError } from "@/src/lib/rooms";
import { publishGameCommandMetric } from "./observability/game-command-metrics";

export type GameCommandReceiptRequest = GameCommandRequestMetadata & {
  session: string;
  commandName: string;
  payload: unknown;
};

type ReceiptRow = {
  command_name: string;
  request_fingerprint: string;
  expected_revision: number;
  base_revision: number;
  revision: number;
  response_value: unknown;
};

export type PreparedGameCommandReceipt = {
  playerId: string;
  fingerprint: string;
  replay: GameCommandResult<unknown> | null;
};

function gameCommandRequestFingerprint(commandName: string, payload: unknown) {
  return createHash("sha256")
    .update(canonicalGameCommandRequest(commandName, payload))
    .digest("hex");
}

async function resolveReceiptPlayerId(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  const player = (
    await client.query<{ id: string }>(
      `SELECT id
       FROM room_players
       WHERE room_id=$1 AND player_session=$2
       FOR UPDATE`,
      [roomId, session],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }

  return player.id;
}

export async function prepareGameCommandReceipt(
  client: PoolClient,
  roomId: string,
  request: GameCommandReceiptRequest,
): Promise<PreparedGameCommandReceipt> {
  const playerId = await resolveReceiptPlayerId(client, roomId, request.session);
  const fingerprint = gameCommandRequestFingerprint(
    request.commandName,
    request.payload,
  );
  const receipt = (
    await client.query<ReceiptRow>(
      `SELECT command_name,request_fingerprint,expected_revision,
              base_revision,revision,response_value
       FROM game_command_receipts
       WHERE room_id=$1 AND player_id=$2 AND command_id=$3`,
      [roomId, playerId, request.commandId],
    )
  ).rows[0];

  if (!receipt) {
    return { playerId, fingerprint, replay: null };
  }

  if (
    receipt.command_name !== request.commandName ||
    receipt.request_fingerprint !== fingerprint ||
    receipt.expected_revision !== request.expectedRevision
  ) {
    publishGameCommandMetric({
      name: "receipt.conflict",
      roomId,
      commandName: request.commandName,
      expectedRevision: request.expectedRevision,
      revision: receipt.revision,
    });
    throw new RoomError(
      "Este identificador de comando já foi utilizado para outra solicitação.",
      409,
      {
        commandId: request.commandId,
        commandName: request.commandName,
      },
    );
  }

  publishGameCommandMetric({
    name: "receipt.replayed",
    roomId,
    commandName: request.commandName,
    expectedRevision: request.expectedRevision,
    revision: receipt.revision,
  });

  return {
    playerId,
    fingerprint,
    replay: {
      value: receipt.response_value,
      baseRevision: receipt.base_revision,
      revision: receipt.revision,
    },
  };
}

export async function saveGameCommandReceipt<T>(
  client: PoolClient,
  roomId: string,
  request: GameCommandReceiptRequest,
  prepared: Pick<PreparedGameCommandReceipt, "playerId" | "fingerprint">,
  result: GameCommandResult<T>,
) {
  await client.query(
    `INSERT INTO game_command_receipts (
       room_id,player_id,command_id,command_name,request_fingerprint,
       expected_revision,base_revision,revision,response_value
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      roomId,
      prepared.playerId,
      request.commandId,
      request.commandName,
      prepared.fingerprint,
      request.expectedRevision,
      result.baseRevision,
      result.revision,
      JSON.stringify(result.value ?? null),
    ],
  );

  publishGameCommandMetric({
    name: "receipt.created",
    roomId,
    commandName: request.commandName,
    expectedRevision: request.expectedRevision,
    revision: result.revision,
  });
}

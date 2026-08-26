import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { gameCommand } from "@/src/lib/game-command";
import {
  TERRITORY_METADATA,
  type CardSymbol,
} from "@/src/lib/game-config";
import {
  isValidTrade,
  reinforcementFor,
  tradeValue,
} from "@/src/lib/game-rules";
import { objectiveWon } from "@/src/lib/game-objective-service";
import {
  jurassicTunnelConnection,
  reachableTerritoryIds,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";
import { RoomError } from "@/src/lib/rooms";

type CommandRoom = {
  id: string;
  status: "order_roll" | "playing" | "finished";
  order_roll_round: number;
  phase: string;
  current_player_id: string | null;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
  reinforcements_remaining: number;
  conquered_this_turn: boolean;
  trade_count: number;
  pending_from_territory_id: number | null;
  last_battle: unknown | null;
};

type CommandPlayer = {
  id: string;
  turn_position: number | null;
};

type OwnedTerritory = {
  territory_id: number;
  owner_player_id: string;
  troops: number;
  moved_in_turn: number;
};

type OrderPlayer = {
  id: string;
};

type OrderRoll = {
  player_id: string;
  roll_round: number;
  value: number;
};

type TradeCard = {
  id: string;
  territory_id: number | null;
  symbol: CardSymbol | null;
  is_wild: boolean;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

function positiveInteger(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RoomError(message, 422);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const result = await client.query<CommandRoom>(
    `SELECT id,status,order_roll_round,phase,current_player_id,round_number,
            jurassic_tunnel_territory_id,reinforcements_remaining,
            conquered_this_turn,trade_count,pending_from_territory_id,last_battle
     FROM game_rooms
     WHERE id=$1`,
    [roomId],
  );

  const room = result.rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function playerFor(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  const result = await client.query<CommandPlayer>(
    `SELECT id,turn_position
     FROM room_players
     WHERE room_id=$1 AND player_session=$2
     FOR UPDATE`,
    [roomId, session],
  );

  const player = result.rows[0];
  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }
  return player;
}

function assertTurn(
  room: CommandRoom,
  player: CommandPlayer,
  phase: string,
) {
  if (
    room.status !== "playing" ||
    room.phase !== phase ||
    room.current_player_id !== player.id
  ) {
    throw new RoomError("Esta ação não está disponível neste momento.", 409, {
      roomStatus: room.status,
      roomPhase: room.phase,
      expectedPhase: phase,
      currentPlayerId: room.current_player_id,
      requestPlayerId: player.id,
    });
  }
}

function chooseJurassicTunnelDestination(previous: number | null) {
  const candidates = Object.keys(TERRITORY_METADATA)
    .map(Number)
    .filter(
      (territoryId) =>
        territoryId !== 1 && territoryId !== 3 && territoryId !== previous,
    );

  return candidates[randomInt(0, candidates.length)];
}

async function ensureJurassicTunnel(client: PoolClient, room: CommandRoom) {
  if (room.status !== "playing" || room.jurassic_tunnel_territory_id) return;

  const destination = chooseJurassicTunnelDestination(null);
  await client.query(
    "UPDATE game_rooms SET jurassic_tunnel_territory_id=$2 WHERE id=$1",
    [room.id, destination],
  );
  room.jurassic_tunnel_territory_id = destination;
}

async function advanceJurassicTunnelRound(
  client: PoolClient,
  room: CommandRoom,
) {
  const destination = chooseJurassicTunnelDestination(
    room.jurassic_tunnel_territory_id,
  );

  await client.query(
    `UPDATE game_rooms
     SET round_number=round_number+1,jurassic_tunnel_territory_id=$2
     WHERE id=$1`,
    [room.id, destination],
  );

  room.round_number += 1;
  room.jurassic_tunnel_territory_id = destination;
}

async function beginReinforcement(
  client: PoolClient,
  room: CommandRoom,
  player: CommandPlayer,
) {
  const owned = (
    await client.query<{ territory_id: number }>(
      `SELECT territory_id
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2`,
      [room.id, player.id],
    )
  ).rows;

  const reinforcements = reinforcementFor(
    owned.map((territory) => territory.territory_id),
  );

  await client.query(
    `UPDATE game_rooms
     SET phase='reinforcement',reinforcements_remaining=$2
     WHERE id=$1`,
    [room.id, reinforcements],
  );
}

async function drawCard(
  client: PoolClient,
  room: CommandRoom,
  playerId: string,
) {
  let card = await client.query<{ id: string }>(
    `SELECT id
     FROM game_cards
     WHERE room_id=$1 AND zone='deck'
     ORDER BY deck_order
     FOR UPDATE
     LIMIT 1`,
    [room.id],
  );

  if (!card.rowCount) {
    const discard = (
      await client.query<{ id: string }>(
        `SELECT id
         FROM game_cards
         WHERE room_id=$1 AND zone='discard'
         FOR UPDATE`,
        [room.id],
      )
    ).rows;

    const order = discard.map((_, index) => index + 1);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(0, index + 1);
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }

    for (const [index, item] of discard.entries()) {
      await client.query(
        `UPDATE game_cards
         SET zone='deck',deck_order=$2
         WHERE id=$1`,
        [item.id, order[index]],
      );
    }

    card = await client.query<{ id: string }>(
      `SELECT id
       FROM game_cards
       WHERE room_id=$1 AND zone='deck'
       ORDER BY deck_order
       FOR UPDATE
       LIMIT 1`,
      [room.id],
    );
  }

  if (card.rowCount) {
    await client.query(
      `UPDATE game_cards
       SET zone='hand',owner_player_id=$2,deck_order=NULL
       WHERE id=$1`,
      [card.rows[0].id, playerId],
    );
  }
}

function histories(players: OrderPlayer[], rolls: OrderRoll[]) {
  const values = new Map(players.map((player) => [player.id, [] as number[]]));
  for (const roll of rolls) values.get(roll.player_id)?.push(roll.value);
  return values;
}

function unresolved(values: Map<string, number[]>) {
  const groups = new Map<string, string[]>();

  for (const [id, history] of values) {
    const key = history.join(",");
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .flat();
}

function eligible(players: OrderPlayer[], rolls: OrderRoll[], round: number) {
  return unresolved(
    histories(
      players,
      rolls.filter((roll) => roll.roll_round < round),
    ),
  );
}

export async function rollOrderDieCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    if (room.status !== "order_roll") {
      throw new RoomError("O sorteio de ordem não está disponível.", 409);
    }

    const player = await playerFor(client, room.id, session);
    const players = (
      await client.query<OrderPlayer>(
        "SELECT id FROM room_players WHERE room_id=$1 ORDER BY joined_at",
        [room.id],
      )
    ).rows;
    const rolls = (
      await client.query<OrderRoll>(
        `SELECT player_id,roll_round,value
         FROM game_order_rolls
         WHERE room_id=$1
         ORDER BY roll_round,rolled_at`,
        [room.id],
      )
    ).rows;

    const current = eligible(players, rolls, room.order_roll_round);
    const nextPlayerId = current.find(
      (playerId) =>
        !rolls.some(
          (roll) =>
            roll.player_id === playerId &&
            roll.roll_round === room.order_roll_round,
        ),
    );

    if (player.id !== nextPlayerId) {
      throw new RoomError("Aguarde sua vez de rolar o dado.", 409, {
        nextPlayerId,
        requestPlayerId: player.id,
      });
    }

    const die = randomInt(1, 7);
    await client.query(
      `INSERT INTO game_order_rolls(room_id,player_id,roll_round,value)
       VALUES($1,$2,$3,$4)`,
      [room.id, player.id, room.order_roll_round, die],
    );

    return { value: die };
  });
}

export async function phaseCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);

    if (input.action === "finishCards") {
      assertTurn(room, player, "cards");
      await beginReinforcement(client, room, player);
      return null;
    }

    if (input.action === "finishAttack") {
      assertTurn(room, player, "attack");
      if (room.last_battle !== null || room.pending_from_territory_id) {
        throw new RoomError(
          "Conclua a batalha atual antes de encerrar os ataques.",
          409,
        );
      }

      await client.query(
        "UPDATE game_rooms SET phase='maneuver' WHERE id=$1",
        [room.id],
      );
      return null;
    }

    if (input.action !== "endTurn") {
      throw new RoomError("Ação de fase inválida.", 422);
    }

    assertTurn(room, player, "maneuver");

    if (room.conquered_this_turn) {
      await drawCard(client, room, player.id);
    }

    const next =
      (
        await client.query<{ id: string; turn_position: number | null }>(
          `SELECT p.id,p.turn_position
           FROM room_players p
           WHERE p.room_id=$1
             AND p.turn_position>(SELECT turn_position FROM room_players WHERE id=$2)
             AND EXISTS(
               SELECT 1
               FROM game_territories
               WHERE room_id=$1 AND owner_player_id=p.id
             )
           ORDER BY p.turn_position
           LIMIT 1`,
          [room.id, player.id],
        )
      ).rows[0] ??
      (
        await client.query<{ id: string; turn_position: number | null }>(
          `SELECT p.id,p.turn_position
           FROM room_players p
           WHERE p.room_id=$1
             AND EXISTS(
               SELECT 1
               FROM game_territories
               WHERE room_id=$1 AND owner_player_id=p.id
             )
           ORDER BY p.turn_position
           LIMIT 1`,
          [room.id],
        )
      ).rows[0];

    if (!next) {
      throw new RoomError("Não há próximo jogador ativo.", 409);
    }

    if ((next.turn_position ?? 0) <= (player.turn_position ?? 0)) {
      await advanceJurassicTunnelRound(client, room);
    }

    await client.query(
      "UPDATE game_territories SET moved_in_turn=0 WHERE room_id=$1",
      [room.id],
    );
    await client.query(
      `UPDATE game_rooms
       SET phase='cards',current_player_id=$2,turn_number=turn_number+1,
           reinforcements_remaining=0,conquered_this_turn=FALSE
       WHERE id=$1`,
      [room.id, next.id],
    );

    return null;
  });
}

export async function reinforceCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const territoryId = positiveInteger(
    input.territoryId,
    "Território inválido.",
  );
  const troops = positiveInteger(
    input.troops,
    "Quantidade de tropas inválida.",
  );

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
    assertTurn(room, player, "reinforcement");

    if (troops > room.reinforcements_remaining) {
      throw new RoomError("Você não possui reforços suficientes.", 409);
    }

    const own = await client.query(
      `SELECT 1
       FROM game_territories
       WHERE room_id=$1 AND territory_id=$2 AND owner_player_id=$3
       FOR UPDATE`,
      [room.id, territoryId, player.id],
    );

    if (!own.rowCount) {
      throw new RoomError(
        "Você só pode reforçar territórios próprios.",
        409,
      );
    }

    const remaining = room.reinforcements_remaining - troops;
    await client.query(
      `UPDATE game_territories
       SET troops=troops+$3
       WHERE room_id=$1 AND territory_id=$2`,
      [room.id, territoryId, troops],
    );
    await client.query(
      `UPDATE game_rooms
       SET reinforcements_remaining=$2,
           phase=CASE WHEN $2=0 THEN 'attack' ELSE phase END
       WHERE id=$1`,
      [room.id, remaining],
    );

    await objectiveWon(client, room.id, player.id);
    return null;
  });
}

export async function tradeCardsCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const ids = Array.isArray(input.cardIds)
    ? input.cardIds.filter((card): card is string => typeof card === "string")
    : [];

  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new RoomError("Selecione exatamente três cartas diferentes.", 422);
  }

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);

    if (
      room.status !== "playing" ||
      room.current_player_id !== player.id ||
      !["cards", "reinforcement"].includes(room.phase)
    ) {
      throw new RoomError("A troca não está disponível neste momento.", 409);
    }

    const cards = await client.query<TradeCard>(
      `SELECT id,territory_id,symbol,is_wild
       FROM game_cards
       WHERE room_id=$1
         AND owner_player_id=$2
         AND zone='hand'
         AND id=ANY($3::bigint[])
       FOR UPDATE`,
      [room.id, player.id, ids],
    );

    if (cards.rowCount !== 3) {
      throw new RoomError(
        "Uma das cartas selecionadas não está na sua mão.",
        409,
      );
    }

    const symbols = cards.rows.map((card) =>
      card.is_wild ? "wild" : card.symbol!,
    ) as Array<CardSymbol | "wild">;

    if (!isValidTrade(symbols)) {
      throw new RoomError("Esta combinação de cartas não é válida.", 422);
    }

    const owned = new Set(
      (
        await client.query<{ territory_id: number }>(
          `SELECT territory_id
           FROM game_territories
           WHERE room_id=$1 AND owner_player_id=$2`,
          [room.id, player.id],
        )
      ).rows.map((row) => row.territory_id),
    );

    await client.query(
      `UPDATE game_cards
       SET zone='discard',owner_player_id=NULL,deck_order=NULL
       WHERE id=ANY($1::bigint[])`,
      [ids],
    );

    for (const card of cards.rows) {
      if (card.territory_id && owned.has(card.territory_id)) {
        await client.query(
          `UPDATE game_territories
           SET troops=troops+2
           WHERE room_id=$1 AND territory_id=$2`,
          [room.id, card.territory_id],
        );
      }
    }

    await client.query(
      `UPDATE game_rooms
       SET reinforcements_remaining=reinforcements_remaining+$2,
           trade_count=trade_count+1
       WHERE id=$1`,
      [room.id, tradeValue(room.trade_count)],
    );

    await objectiveWon(client, room.id, player.id);
    return null;
  });
}

export async function maneuverCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const from = positiveInteger(
    input.fromTerritoryId,
    "Território de origem inválido.",
  );
  const to = positiveInteger(
    input.toTerritoryId,
    "Território de destino inválido.",
  );
  const troops = positiveInteger(
    input.troops,
    "Quantidade de tropas inválida.",
  );

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
    assertTurn(room, player, "maneuver");
    await ensureJurassicTunnel(client, room);

    if (from === to) {
      throw new RoomError(
        "Origem e destino precisam ser territórios diferentes.",
        422,
      );
    }

    const owned = (
      await client.query<OwnedTerritory>(
        `SELECT territory_id,owner_player_id,troops,moved_in_turn
         FROM game_territories
         WHERE room_id=$1 AND owner_player_id=$2
         FOR UPDATE`,
        [room.id, player.id],
      )
    ).rows;

    const source = owned.find((territory) => territory.territory_id === from);
    const destination = owned.find(
      (territory) => territory.territory_id === to,
    );

    if (!source || !destination) {
      throw new RoomError(
        "Você só pode deslocar tropas entre territórios próprios.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          requestPlayerId: player.id,
        },
      );
    }

    const connectionRows = (
      await client.query<{
        territory_a: number;
        territory_b: number;
        is_passable: boolean;
        barrier_name: string | null;
        description: string | null;
      }>(
        `SELECT territory_a,territory_b,is_passable,barrier_name,description
         FROM territory_connections
         WHERE is_passable=TRUE`,
      )
    ).rows;

    const connections: TerritoryConnection[] = connectionRows.map(
      (connection) => ({
        territoryA: connection.territory_a,
        territoryB: connection.territory_b,
        exists: true,
        passable: connection.is_passable,
        barrierName: connection.barrier_name,
        description: connection.description,
      }),
    );

    const tunnelConnection = jurassicTunnelConnection(
      room.jurassic_tunnel_territory_id,
    );
    if (tunnelConnection) connections.push(tunnelConnection);

    const reachable = new Set(
      reachableTerritoryIds(
        connections,
        from,
        owned.map((territory) => territory.territory_id),
      ),
    );

    if (!reachable.has(to)) {
      throw new RoomError(
        "Não existe um caminho contínuo por territórios próprios entre a origem e o destino.",
        409,
        { fromTerritoryId: from, toTerritoryId: to },
      );
    }

    if (troops > source.troops - source.moved_in_turn - 1) {
      throw new RoomError(
        "Estas tropas já foram deslocadas ou o território ficaria vazio.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          requestedTroops: troops,
          sourceTroops: source.troops,
          movedInTurn: source.moved_in_turn,
        },
      );
    }

    await client.query(
      "UPDATE game_territories SET troops=troops-$3 WHERE room_id=$1 AND territory_id=$2",
      [room.id, from, troops],
    );
    await client.query(
      `UPDATE game_territories
       SET troops=troops+$3,moved_in_turn=moved_in_turn+$3
       WHERE room_id=$1 AND territory_id=$2`,
      [room.id, to, troops],
    );

    return null;
  });
}

import "server-only";

import type { PoolClient } from "pg";
import { playerGameCommand } from "@/src/lib/game-command";
import { resolveCommandPlayerBySession } from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import {
  isTradeCardDescriptor,
  PLAYER_TRADE_OFFER_LIMIT,
  PLAYER_TRADE_SIGNAL_LIMIT,
  type TradeCardDescriptor,
} from "@/src/lib/game-trade-rules";
import { RoomError } from "@/src/lib/rooms";
import { pool } from "./db/pool";
import { publishGameTradeSignal } from "./game-realtime-publisher";
import { beginReinforcementForPlayer } from "./game-turn-service";

type TradeRoom = {
  id: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  turn_number: number;
  trade_offers_used: number;
};

type TradePlayer = {
  id: string;
  is_bot: boolean;
  turn_position: number | null;
  trade_signals_used: number;
};

type TradeCardRow = {
  id: string;
  owner_player_id: string | null;
  territory_id: number | null;
  symbol: "leaf" | "gold" | "water" | null;
  is_wild: boolean;
  zone: string;
};

type TradeOfferRow = {
  id: string;
  proposer_player_id: string;
  target_player_id: string | null;
  offered_card_id: string;
  requested_kind: "territory" | "symbol" | "wild";
  requested_territory_id: number | null;
  requested_symbol: "leaf" | "gold" | "water" | null;
  status: "open" | "countered";
  responder_player_id: string | null;
  counter_card_id: string | null;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

function numericId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new RoomError(`${label} inválido.`, 422);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string, lock = false) {
  const room = (
    await client.query<TradeRoom>(
      `SELECT id,status,phase,current_player_id,turn_number,trade_offers_used
       FROM game_rooms
       WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
      [roomId],
    )
  ).rows[0];

  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function loadPlayer(
  client: PoolClient,
  roomId: string,
  playerId: string,
  lock = false,
) {
  return (
    await client.query<TradePlayer>(
      `SELECT id,is_bot,turn_position,trade_signals_used
       FROM room_players
       WHERE room_id=$1 AND id=$2${lock ? " FOR UPDATE" : ""}`,
      [roomId, playerId],
    )
  ).rows[0] ?? null;
}

async function playerBySession(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  return (
    await client.query<TradePlayer>(
      `SELECT id,is_bot,turn_position,trade_signals_used
       FROM room_players
       WHERE room_id=$1 AND player_session=$2
       FOR UPDATE`,
      [roomId, session],
    )
  ).rows[0] ?? null;
}

function assertTradePhase(room: TradeRoom) {
  if (
    room.status !== "playing" ||
    room.phase !== "trade" ||
    room.current_player_id === null
  ) {
    throw new RoomError("A fase de troca não está disponível neste momento.", 409);
  }
}

function assertNegotiatingHuman(player: TradePlayer | null) {
  if (!player || player.is_bot || player.turn_position === null) {
    throw new RoomError("A negociação exige um jogador humano ainda ativo.", 409);
  }
}

async function assertActiveHuman(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
) {
  assertTradePhase(room);
  if (room.current_player_id !== playerId) {
    throw new RoomError("Apenas o jogador do turno pode iniciar esta ação.", 409);
  }
  const player = await loadPlayer(client, room.id, playerId);
  assertNegotiatingHuman(player);
}

async function assertResponder(
  client: PoolClient,
  room: TradeRoom,
  offer: TradeOfferRow,
  playerId: string,
) {
  assertTradePhase(room);
  if (playerId === offer.proposer_player_id || playerId === room.current_player_id) {
    throw new RoomError("O jogador do turno não pode responder à própria oferta.", 409);
  }
  if (offer.target_player_id && offer.target_player_id !== playerId) {
    throw new RoomError("Esta oferta foi direcionada a outro jogador.", 409);
  }
  const player = await loadPlayer(client, room.id, playerId);
  assertNegotiatingHuman(player);
}

async function loadHandCard(
  client: PoolClient,
  roomId: string,
  playerId: string,
  cardId: string,
) {
  const card = (
    await client.query<TradeCardRow>(
      `SELECT id,owner_player_id,territory_id,symbol,is_wild,zone
       FROM game_cards
       WHERE room_id=$1 AND id=$2
       FOR UPDATE`,
      [roomId, cardId],
    )
  ).rows[0];

  if (!card || card.owner_player_id !== playerId || card.zone !== "hand") {
    throw new RoomError("A carta selecionada não está mais na sua mão.", 409);
  }
  return card;
}

function cardDescriptor(card: TradeCardRow): TradeCardDescriptor {
  if (card.is_wild) return { kind: "wild" };
  if (card.territory_id === null) {
    throw new RoomError("Carta de território inválida.", 500);
  }
  return { kind: "territory", territoryId: card.territory_id };
}

function requestedDescriptor(offer: TradeOfferRow): TradeCardDescriptor {
  if (offer.requested_kind === "wild") return { kind: "wild" };
  if (offer.requested_kind === "territory") {
    if (offer.requested_territory_id === null) {
      throw new RoomError("Oferta de troca inválida.", 500);
    }
    return { kind: "territory", territoryId: offer.requested_territory_id };
  }
  if (offer.requested_symbol === null) {
    throw new RoomError("Oferta de troca inválida.", 500);
  }
  return { kind: "symbol", symbol: offer.requested_symbol };
}

function cardMatches(card: TradeCardRow, descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return card.is_wild;
  if (descriptor.kind === "territory") {
    return !card.is_wild && card.territory_id === descriptor.territoryId;
  }
  return !card.is_wild && card.symbol === descriptor.symbol;
}

async function activeOffer(client: PoolClient, roomId: string) {
  return (
    await client.query<TradeOfferRow>(
      `SELECT id,proposer_player_id,target_player_id,offered_card_id,
              requested_kind,requested_territory_id,requested_symbol,
              status,responder_player_id,counter_card_id
       FROM game_player_trade_offers
       WHERE room_id=$1 AND status IN ('open','countered')
       ORDER BY id DESC
       FOR UPDATE
       LIMIT 1`,
      [roomId],
    )
  ).rows[0] ?? null;
}

async function offerById(
  client: PoolClient,
  roomId: string,
  offerId: string,
) {
  const offer = await activeOffer(client, roomId);
  if (!offer || offer.id !== offerId) {
    throw new RoomError("Esta oferta não está mais disponível.", 409);
  }
  return offer;
}

async function swapCards(
  client: PoolClient,
  roomId: string,
  proposerPlayerId: string,
  responderPlayerId: string,
  proposerCardId: string,
  responderCardId: string,
) {
  await loadHandCard(client, roomId, proposerPlayerId, proposerCardId);
  await loadHandCard(client, roomId, responderPlayerId, responderCardId);

  await client.query(
    `UPDATE game_cards
     SET owner_player_id=CASE
       WHEN id=$2 THEN $4::bigint
       WHEN id=$3 THEN $5::bigint
       ELSE owner_player_id
     END
     WHERE room_id=$1 AND id IN ($2,$3) AND zone='hand'`,
    [
      roomId,
      proposerCardId,
      responderCardId,
      responderPlayerId,
      proposerPlayerId,
    ],
  );
}

async function finishIfOfferBudgetEnded(
  client: PoolClient,
  room: TradeRoom,
) {
  const current = await loadRoom(client, room.id);
  if (current.trade_offers_used < PLAYER_TRADE_OFFER_LIMIT) return false;
  await beginReinforcementForPlayer(client, room.id, room.current_player_id!);
  return true;
}

async function createOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  await assertActiveHuman(client, room, playerId);
  if (room.trade_offers_used >= PLAYER_TRADE_OFFER_LIMIT) {
    throw new RoomError("O limite de ofertas deste turno já foi usado.", 409);
  }
  if (await activeOffer(client, room.id)) {
    throw new RoomError("Resolva a oferta atual antes de criar outra.", 409);
  }

  const offeredCardId = numericId(input.offeredCardId, "Carta oferecida");
  const offeredCard = await loadHandCard(client, room.id, playerId, offeredCardId);
  if (!isTradeCardDescriptor(input.requested)) {
    throw new RoomError("Carta solicitada inválida.", 422);
  }

  let targetPlayerId: string | null = null;
  if (input.targetPlayerId !== undefined && input.targetPlayerId !== null) {
    targetPlayerId = numericId(input.targetPlayerId, "Jogador alvo");
    if (targetPlayerId === playerId) {
      throw new RoomError("Você não pode direcionar uma oferta para si mesmo.", 422);
    }
    const target = await loadPlayer(client, room.id, targetPlayerId);
    if (!target || target.is_bot || target.turn_position === null) {
      throw new RoomError("A oferta deve ser direcionada a um jogador humano ativo.", 422);
    }
  }

  const requested = input.requested;
  const requestedTerritoryId =
    requested.kind === "territory" ? requested.territoryId : null;
  const requestedSymbol = requested.kind === "symbol" ? requested.symbol : null;

  const inserted = (
    await client.query<{ id: string }>(
      `INSERT INTO game_player_trade_offers(
         room_id,turn_number,proposer_player_id,target_player_id,offered_card_id,
         requested_kind,requested_territory_id,requested_symbol
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        room.id,
        room.turn_number,
        playerId,
        targetPlayerId,
        offeredCard.id,
        requested.kind,
        requestedTerritoryId,
        requestedSymbol,
      ],
    )
  ).rows[0];

  await client.query(
    `UPDATE game_rooms
     SET trade_offers_used=trade_offers_used+1
     WHERE id=$1`,
    [room.id],
  );

  return { offerId: inserted.id, offered: cardDescriptor(offeredCard) };
}

async function acceptOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  const offerId = numericId(input.offerId, "Oferta");
  const cardId = numericId(input.cardId, "Carta");
  const offer = await offerById(client, room.id, offerId);
  if (offer.status !== "open") {
    throw new RoomError("A oferta possui uma contraoferta pendente.", 409);
  }
  await assertResponder(client, room, offer, playerId);
  const responseCard = await loadHandCard(client, room.id, playerId, cardId);
  if (!cardMatches(responseCard, requestedDescriptor(offer))) {
    throw new RoomError("A carta selecionada não atende ao pedido da oferta.", 422);
  }

  await swapCards(
    client,
    room.id,
    offer.proposer_player_id,
    playerId,
    offer.offered_card_id,
    responseCard.id,
  );
  await client.query(
    `UPDATE game_player_trade_offers
     SET status='accepted',responder_player_id=$3,accepted_card_id=$4,resolved_at=NOW()
     WHERE room_id=$1 AND id=$2`,
    [room.id, offer.id, playerId, responseCard.id],
  );
  await beginReinforcementForPlayer(client, room.id, offer.proposer_player_id);
  return { completed: true };
}

async function counterOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  const offerId = numericId(input.offerId, "Oferta");
  const cardId = numericId(input.cardId, "Carta");
  const offer = await offerById(client, room.id, offerId);
  if (offer.status !== "open") {
    throw new RoomError("Esta oferta já possui uma contraoferta.", 409);
  }
  await assertResponder(client, room, offer, playerId);
  await loadHandCard(client, room.id, playerId, cardId);

  await client.query(
    `UPDATE game_player_trade_offers
     SET status='countered',responder_player_id=$3,counter_card_id=$4
     WHERE room_id=$1 AND id=$2`,
    [room.id, offer.id, playerId, cardId],
  );
  return { countered: true };
}

async function acceptCounter(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  await assertActiveHuman(client, room, playerId);
  const offerId = numericId(input.offerId, "Oferta");
  const offer = await offerById(client, room.id, offerId);
  if (
    offer.status !== "countered" ||
    !offer.responder_player_id ||
    !offer.counter_card_id
  ) {
    throw new RoomError("Não existe contraoferta para aceitar.", 409);
  }

  await swapCards(
    client,
    room.id,
    playerId,
    offer.responder_player_id,
    offer.offered_card_id,
    offer.counter_card_id,
  );
  await client.query(
    `UPDATE game_player_trade_offers
     SET status='accepted',accepted_card_id=counter_card_id,resolved_at=NOW()
     WHERE room_id=$1 AND id=$2`,
    [room.id, offer.id],
  );
  await beginReinforcementForPlayer(client, room.id, playerId);
  return { completed: true };
}

async function closeOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
  status: "declined" | "cancelled",
) {
  const offerId = numericId(input.offerId, "Oferta");
  const offer = await offerById(client, room.id, offerId);

  if (status === "cancelled") {
    await assertActiveHuman(client, room, playerId);
  } else if (offer.status === "open") {
    if (!offer.target_player_id) {
      throw new RoomError(
        "Uma oferta aberta não pode ser encerrada pela recusa de apenas um jogador.",
        409,
      );
    }
    await assertResponder(client, room, offer, playerId);
  } else if (
    playerId !== offer.proposer_player_id &&
    playerId !== offer.responder_player_id
  ) {
    throw new RoomError("Você não pode encerrar esta contraoferta.", 409);
  }

  await client.query(
    `UPDATE game_player_trade_offers
     SET status=$3,resolved_at=NOW()
     WHERE room_id=$1 AND id=$2`,
    [room.id, offer.id, status],
  );
  const advanced = await finishIfOfferBudgetEnded(client, room);
  return { advanced };
}

async function finishTrade(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
) {
  await assertActiveHuman(client, room, playerId);
  await client.query(
    `UPDATE game_player_trade_offers
     SET status='cancelled',resolved_at=NOW()
     WHERE room_id=$1 AND status IN ('open','countered')`,
    [room.id],
  );
  await beginReinforcementForPlayer(client, room.id, playerId);
  return { advanced: true };
}

export async function executePlayerTradeAction(
  client: PoolClient,
  roomId: string,
  playerId: string,
  input: Record<string, unknown>,
) {
  const room = await loadRoom(client, roomId);
  assertTradePhase(room);

  switch (input.action) {
    case "offer":
      return createOffer(client, room, playerId, input);
    case "accept":
      return acceptOffer(client, room, playerId, input);
    case "counter":
      return counterOffer(client, room, playerId, input);
    case "acceptCounter":
      return acceptCounter(client, room, playerId, input);
    case "decline":
      return closeOffer(client, room, playerId, input, "declined");
    case "cancel":
      return closeOffer(client, room, playerId, input, "cancelled");
    case "finish":
      return finishTrade(client, room, playerId);
    default:
      throw new RoomError("Ação de negociação inválida.", 422);
  }
}

export async function playerTradeCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "player_trade",
    input,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executePlayerTradeAction(client, roomId, player.id, input);
    },
  );
}

export async function signalPlayerTradeCard(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const cardId = numericId(input.cardId, "Carta");
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const room = await loadRoom(client, roomId, true);
    assertTradePhase(room);

    const player = await playerBySession(client, roomId, session);
    if (!player) {
      throw new RoomError("Você não pertence a esta partida.", 403);
    }
    if (
      player.is_bot ||
      player.turn_position === null ||
      player.id === room.current_player_id
    ) {
      throw new RoomError("A sinalização é exclusiva dos outros jogadores humanos ativos.", 409);
    }
    if (player.trade_signals_used >= PLAYER_TRADE_SIGNAL_LIMIT) {
      throw new RoomError("O limite de sinalizações deste turno já foi usado.", 409);
    }

    const card = await loadHandCard(client, room.id, player.id, cardId);
    if (card.is_wild || card.territory_id === null) {
      throw new RoomError("Apenas cartas de território podem ser sinalizadas.", 422);
    }

    const activeOwnsTerritory = Boolean(
      (
        await client.query(
          `SELECT 1
           FROM game_territories
           WHERE room_id=$1 AND territory_id=$2 AND owner_player_id=$3`,
          [room.id, card.territory_id, room.current_player_id],
        )
      ).rowCount,
    );
    if (!activeOwnsTerritory) {
      throw new RoomError(
        "Só é possível sinalizar uma carta de território controlado pelo jogador do turno.",
        422,
      );
    }

    const signalsUsed = player.trade_signals_used + 1;
    await client.query(
      `UPDATE room_players
       SET trade_signals_used=$3
       WHERE room_id=$1 AND id=$2`,
      [room.id, player.id, signalsUsed],
    );

    await publishGameTradeSignal(client, {
      roomId: room.id,
      playerId: player.id,
      turnNumber: room.turn_number,
      card: cardDescriptor(card),
    });

    await client.query("COMMIT");
    transactionOpen = false;
    return { signalsUsed };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

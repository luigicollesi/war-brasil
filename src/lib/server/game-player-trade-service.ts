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

type TradeOfferStatus =
  | "open"
  | "countered"
  | "accepted_pending_selection";

type TradeOfferRow = {
  id: string;
  turn_number: number;
  proposer_player_id: string;
  target_player_id: string;
  offered_kind: "territory" | "symbol" | "wild";
  offered_territory_id: number | null;
  offered_symbol: "leaf" | "gold" | "water" | null;
  requested_kind: "territory" | "symbol" | "wild";
  requested_territory_id: number | null;
  requested_symbol: "leaf" | "gold" | "water" | null;
  status: TradeOfferStatus;
  responder_player_id: string | null;
  counter_offered_kind: "territory" | "symbol" | "wild" | null;
  counter_offered_territory_id: number | null;
  counter_offered_symbol: "leaf" | "gold" | "water" | null;
  counter_requested_kind: "territory" | "symbol" | "wild" | null;
  counter_requested_territory_id: number | null;
  counter_requested_symbol: "leaf" | "gold" | "water" | null;
  accepted_terms: "original" | "counter" | null;
  proposer_selected_card_id: string | null;
  responder_selected_card_id: string | null;
};

type DescriptorColumns = {
  kind: "territory" | "symbol" | "wild";
  territoryId: number | null;
  symbol: "leaf" | "gold" | "water" | null;
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

function descriptorColumns(descriptor: TradeCardDescriptor): DescriptorColumns {
  return {
    kind: descriptor.kind,
    territoryId: descriptor.kind === "territory" ? descriptor.territoryId : null,
    symbol: descriptor.kind === "symbol" ? descriptor.symbol : null,
  };
}

function descriptorFromColumns(
  kind: "territory" | "symbol" | "wild" | null,
  territoryId: number | null,
  symbol: "leaf" | "gold" | "water" | null,
  label: string,
): TradeCardDescriptor {
  if (kind === "wild") return { kind: "wild" };
  if (kind === "territory" && territoryId !== null) {
    return { kind: "territory", territoryId };
  }
  if (kind === "symbol" && symbol !== null) {
    return { kind: "symbol", symbol };
  }
  throw new RoomError(`${label} inválido na negociação.`, 500);
}

function originalOfferedDescriptor(offer: TradeOfferRow) {
  return descriptorFromColumns(
    offer.offered_kind,
    offer.offered_territory_id,
    offer.offered_symbol,
    "Oferta",
  );
}

function originalRequestedDescriptor(offer: TradeOfferRow) {
  return descriptorFromColumns(
    offer.requested_kind,
    offer.requested_territory_id,
    offer.requested_symbol,
    "Pedido",
  );
}

function counterOfferedDescriptor(offer: TradeOfferRow) {
  return descriptorFromColumns(
    offer.counter_offered_kind,
    offer.counter_offered_territory_id,
    offer.counter_offered_symbol,
    "Contraoferta",
  );
}

function counterRequestedDescriptor(offer: TradeOfferRow) {
  return descriptorFromColumns(
    offer.counter_requested_kind,
    offer.counter_requested_territory_id,
    offer.counter_requested_symbol,
    "Pedido da contraoferta",
  );
}

function acceptedDescriptors(offer: TradeOfferRow) {
  if (offer.accepted_terms === "original") {
    return {
      proposer: originalOfferedDescriptor(offer),
      responder: originalRequestedDescriptor(offer),
    };
  }
  if (offer.accepted_terms === "counter") {
    return {
      proposer: counterRequestedDescriptor(offer),
      responder: counterOfferedDescriptor(offer),
    };
  }
  throw new RoomError("A negociação aceita não possui termos definidos.", 500);
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
  if (offer.target_player_id !== playerId) {
    throw new RoomError("Esta oferta foi direcionada a outro jogador.", 409);
  }
  if (playerId === room.current_player_id) {
    throw new RoomError("O jogador do turno não pode responder à própria oferta.", 409);
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

function cardMatches(card: TradeCardRow, descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return card.is_wild;
  if (descriptor.kind === "territory") {
    return !card.is_wild && card.territory_id === descriptor.territoryId;
  }
  return !card.is_wild && card.symbol === descriptor.symbol;
}

async function matchingHandCards(
  client: PoolClient,
  roomId: string,
  playerId: string,
  descriptor: TradeCardDescriptor,
) {
  const columns = descriptorColumns(descriptor);
  return (
    await client.query<TradeCardRow>(
      `SELECT id,owner_player_id,territory_id,symbol,is_wild,zone
       FROM game_cards
       WHERE room_id=$1
         AND owner_player_id=$2
         AND zone='hand'
         AND (
           ($3='wild' AND is_wild=TRUE)
           OR ($3='territory' AND is_wild=FALSE AND territory_id=$4)
           OR ($3='symbol' AND is_wild=FALSE AND symbol=$5)
         )
       ORDER BY id
       FOR UPDATE`,
      [roomId, playerId, columns.kind, columns.territoryId, columns.symbol],
    )
  ).rows;
}

async function requireDescriptorAvailable(
  client: PoolClient,
  roomId: string,
  playerId: string,
  descriptor: TradeCardDescriptor,
) {
  const matches = await matchingHandCards(client, roomId, playerId, descriptor);
  if (matches.length === 0) {
    throw new RoomError("Você não possui uma carta compatível com essa oferta.", 409);
  }
}

async function resolveAcceptedCard(
  client: PoolClient,
  roomId: string,
  playerId: string,
  descriptor: TradeCardDescriptor,
) {
  const matches = await matchingHandCards(client, roomId, playerId, descriptor);
  if (matches.length === 0) {
    throw new RoomError("A negociação não pode mais ser cumprida com a mão atual.", 409);
  }
  if (descriptor.kind === "symbol" && matches.length > 1) return null;
  return matches[0].id;
}

async function activeOffer(client: PoolClient, roomId: string) {
  return (
    await client.query<TradeOfferRow>(
      `SELECT id,turn_number,proposer_player_id,target_player_id,
              offered_kind,offered_territory_id,offered_symbol,
              requested_kind,requested_territory_id,requested_symbol,
              status,responder_player_id,
              counter_offered_kind,counter_offered_territory_id,counter_offered_symbol,
              counter_requested_kind,counter_requested_territory_id,counter_requested_symbol,
              accepted_terms,proposer_selected_card_id,responder_selected_card_id
       FROM game_player_trade_offers
       WHERE room_id=$1
         AND status IN ('open','countered','accepted_pending_selection')
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
  proposerDescriptor: TradeCardDescriptor,
  responderDescriptor: TradeCardDescriptor,
) {
  if (proposerCardId === responderCardId) {
    throw new RoomError("Uma troca precisa envolver duas cartas diferentes.", 409);
  }

  const proposerCard = await loadHandCard(
    client,
    roomId,
    proposerPlayerId,
    proposerCardId,
  );
  const responderCard = await loadHandCard(
    client,
    roomId,
    responderPlayerId,
    responderCardId,
  );
  if (!cardMatches(proposerCard, proposerDescriptor)) {
    throw new RoomError("A carta do proponente não atende mais aos termos aceitos.", 409);
  }
  if (!cardMatches(responderCard, responderDescriptor)) {
    throw new RoomError("A carta do destinatário não atende mais aos termos aceitos.", 409);
  }

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

async function finalizeAcceptedTrade(
  client: PoolClient,
  room: TradeRoom,
  offer: TradeOfferRow,
) {
  if (
    offer.status !== "accepted_pending_selection" ||
    !offer.responder_player_id ||
    !offer.proposer_selected_card_id ||
    !offer.responder_selected_card_id
  ) {
    throw new RoomError("A troca ainda possui seleção de carta pendente.", 409);
  }

  const descriptors = acceptedDescriptors(offer);
  await swapCards(
    client,
    room.id,
    offer.proposer_player_id,
    offer.responder_player_id,
    offer.proposer_selected_card_id,
    offer.responder_selected_card_id,
    descriptors.proposer,
    descriptors.responder,
  );

  await client.query(
    `UPDATE game_player_trade_offers
     SET status='accepted',resolved_at=NOW()
     WHERE room_id=$1 AND id=$2 AND status='accepted_pending_selection'`,
    [room.id, offer.id],
  );
  const advanced = await finishIfOfferBudgetEnded(client, room);
  return { completed: true, pendingSelection: false, advanced };
}

async function beginAcceptedTrade(
  client: PoolClient,
  room: TradeRoom,
  offer: TradeOfferRow,
  responderPlayerId: string,
  terms: "original" | "counter",
) {
  const descriptors =
    terms === "original"
      ? {
          proposer: originalOfferedDescriptor(offer),
          responder: originalRequestedDescriptor(offer),
        }
      : {
          proposer: counterRequestedDescriptor(offer),
          responder: counterOfferedDescriptor(offer),
        };

  const proposerCardId = await resolveAcceptedCard(
    client,
    room.id,
    offer.proposer_player_id,
    descriptors.proposer,
  );
  const responderCardId = await resolveAcceptedCard(
    client,
    room.id,
    responderPlayerId,
    descriptors.responder,
  );

  await client.query(
    `UPDATE game_player_trade_offers
     SET status='accepted_pending_selection',
         responder_player_id=$3,
         accepted_terms=$4,
         proposer_selected_card_id=$5,
         responder_selected_card_id=$6
     WHERE room_id=$1 AND id=$2`,
    [
      room.id,
      offer.id,
      responderPlayerId,
      terms,
      proposerCardId,
      responderCardId,
    ],
  );

  const acceptedOffer: TradeOfferRow = {
    ...offer,
    status: "accepted_pending_selection",
    responder_player_id: responderPlayerId,
    accepted_terms: terms,
    proposer_selected_card_id: proposerCardId,
    responder_selected_card_id: responderCardId,
  };

  if (proposerCardId && responderCardId) {
    return finalizeAcceptedTrade(client, room, acceptedOffer);
  }
  return { completed: false, pendingSelection: true, advanced: false };
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
  if (!isTradeCardDescriptor(input.offered)) {
    throw new RoomError("Carta oferecida inválida.", 422);
  }
  if (!isTradeCardDescriptor(input.requested)) {
    throw new RoomError("Carta solicitada inválida.", 422);
  }

  const targetPlayerId = numericId(input.targetPlayerId, "Jogador alvo");
  if (targetPlayerId === playerId) {
    throw new RoomError("Você não pode direcionar uma oferta para si mesmo.", 422);
  }
  const target = await loadPlayer(client, room.id, targetPlayerId);
  if (!target || target.is_bot || target.turn_position === null) {
    throw new RoomError("A oferta deve ser direcionada a um jogador humano ativo.", 422);
  }

  const offered = input.offered;
  const requested = input.requested;
  await requireDescriptorAvailable(client, room.id, playerId, offered);
  const offeredColumns = descriptorColumns(offered);
  const requestedColumns = descriptorColumns(requested);

  const inserted = (
    await client.query<{ id: string }>(
      `INSERT INTO game_player_trade_offers(
         room_id,turn_number,proposer_player_id,target_player_id,
         offered_kind,offered_territory_id,offered_symbol,
         requested_kind,requested_territory_id,requested_symbol
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        room.id,
        room.turn_number,
        playerId,
        targetPlayerId,
        offeredColumns.kind,
        offeredColumns.territoryId,
        offeredColumns.symbol,
        requestedColumns.kind,
        requestedColumns.territoryId,
        requestedColumns.symbol,
      ],
    )
  ).rows[0];

  await client.query(
    `UPDATE game_rooms
     SET trade_offers_used=trade_offers_used+1
     WHERE id=$1`,
    [room.id],
  );

  return { offerId: inserted.id };
}

async function acceptOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  const offerId = numericId(input.offerId, "Oferta");
  const offer = await offerById(client, room.id, offerId);
  if (offer.status !== "open") {
    throw new RoomError("A oferta não está aguardando aceite do destinatário.", 409);
  }
  await assertResponder(client, room, offer, playerId);
  return beginAcceptedTrade(client, room, offer, playerId, "original");
}

async function counterOffer(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  const offerId = numericId(input.offerId, "Oferta");
  const offer = await offerById(client, room.id, offerId);
  if (offer.status !== "open") {
    throw new RoomError("Esta oferta já possui uma resposta.", 409);
  }
  await assertResponder(client, room, offer, playerId);
  if (!isTradeCardDescriptor(input.offered)) {
    throw new RoomError("Carta oferecida na contraoferta é inválida.", 422);
  }
  if (!isTradeCardDescriptor(input.requested)) {
    throw new RoomError("Carta solicitada na contraoferta é inválida.", 422);
  }

  const offered = input.offered;
  const requested = input.requested;
  await requireDescriptorAvailable(client, room.id, playerId, offered);
  const offeredColumns = descriptorColumns(offered);
  const requestedColumns = descriptorColumns(requested);

  await client.query(
    `UPDATE game_player_trade_offers
     SET status='countered',responder_player_id=$3,
         counter_offered_kind=$4,counter_offered_territory_id=$5,counter_offered_symbol=$6,
         counter_requested_kind=$7,counter_requested_territory_id=$8,counter_requested_symbol=$9
     WHERE room_id=$1 AND id=$2`,
    [
      room.id,
      offer.id,
      playerId,
      offeredColumns.kind,
      offeredColumns.territoryId,
      offeredColumns.symbol,
      requestedColumns.kind,
      requestedColumns.territoryId,
      requestedColumns.symbol,
    ],
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
    offer.proposer_player_id !== playerId ||
    !offer.responder_player_id
  ) {
    throw new RoomError("Não existe contraoferta para aceitar.", 409);
  }

  return beginAcceptedTrade(
    client,
    room,
    offer,
    offer.responder_player_id,
    "counter",
  );
}

async function selectAcceptedCard(
  client: PoolClient,
  room: TradeRoom,
  playerId: string,
  input: Record<string, unknown>,
) {
  const offerId = numericId(input.offerId, "Oferta");
  const cardId = numericId(input.cardId, "Carta");
  const offer = await offerById(client, room.id, offerId);
  if (offer.status !== "accepted_pending_selection" || !offer.responder_player_id) {
    throw new RoomError("Esta negociação não aguarda seleção de carta.", 409);
  }

  const descriptors = acceptedDescriptors(offer);
  let descriptor: TradeCardDescriptor;
  let column: "proposer_selected_card_id" | "responder_selected_card_id";

  if (playerId === offer.proposer_player_id) {
    if (offer.proposer_selected_card_id) {
      throw new RoomError("Sua carta desta negociação já foi definida.", 409);
    }
    descriptor = descriptors.proposer;
    column = "proposer_selected_card_id";
  } else if (playerId === offer.responder_player_id) {
    if (offer.responder_selected_card_id) {
      throw new RoomError("Sua carta desta negociação já foi definida.", 409);
    }
    descriptor = descriptors.responder;
    column = "responder_selected_card_id";
  } else {
    throw new RoomError("Você não participa desta negociação aceita.", 409);
  }

  if (descriptor.kind !== "symbol") {
    throw new RoomError("Esta carta deveria ter sido resolvida automaticamente.", 409);
  }
  const card = await loadHandCard(client, room.id, playerId, cardId);
  if (!cardMatches(card, descriptor)) {
    throw new RoomError("A carta selecionada não corresponde ao símbolo negociado.", 422);
  }

  await client.query(
    `UPDATE game_player_trade_offers
     SET ${column}=$3
     WHERE room_id=$1 AND id=$2 AND status='accepted_pending_selection'`,
    [room.id, offer.id, card.id],
  );

  const refreshed = await offerById(client, room.id, offer.id);
  if (refreshed.proposer_selected_card_id && refreshed.responder_selected_card_id) {
    return finalizeAcceptedTrade(client, room, refreshed);
  }
  return { completed: false, pendingSelection: true, advanced: false };
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

  if (offer.status === "accepted_pending_selection") {
    throw new RoomError("Uma negociação já aceita não pode ser cancelada ou recusada.", 409);
  }

  if (status === "cancelled") {
    await assertActiveHuman(client, room, playerId);
    if (offer.status !== "open" || offer.proposer_player_id !== playerId) {
      throw new RoomError("Só a oferta original aguardando resposta pode ser cancelada.", 409);
    }
  } else if (offer.status === "open") {
    await assertResponder(client, room, offer, playerId);
  } else {
    await assertActiveHuman(client, room, playerId);
    if (offer.proposer_player_id !== playerId) {
      throw new RoomError("Apenas o proponente original pode recusar a contraoferta.", 409);
    }
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
  if (await activeOffer(client, room.id)) {
    throw new RoomError(
      "Resolva ou cancele a negociação pendente antes de iniciar os reforços.",
      409,
    );
  }
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
    case "selectCard":
      return selectAcceptedCard(client, room, playerId, input);
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
  if (!isTradeCardDescriptor(input.card)) {
    throw new RoomError("Sinalização de carta inválida.", 422);
  }
  const descriptor = input.card;
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

    await requireDescriptorAvailable(client, room.id, player.id, descriptor);

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
      card: descriptor,
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
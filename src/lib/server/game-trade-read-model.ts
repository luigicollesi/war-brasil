import "server-only";

import type { PoolClient } from "pg";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type {
  GameCard,
  GameTradeOffer,
  GameTradePrivateState,
  GameTradePublicState,
  GameTradeTerms,
} from "@/src/lib/game-contract";
import type { GamePrivatePatch } from "@/src/lib/game-private-patch";
import {
  PLAYER_TRADE_OFFER_LIMIT,
  PLAYER_TRADE_SIGNAL_LIMIT,
  type TradeCardDescriptor,
} from "@/src/lib/game-trade-rules";
import { RoomError } from "@/src/lib/rooms";

type TradeRoomProjection = {
  status: "waiting" | "order_roll" | "playing" | "finished";
  phase: string;
  reinforcements_remaining: number;
  trade_offers_used: number;
};

type TradeOfferProjection = {
  id: string;
  proposer_player_id: string;
  target_player_id: string;
  offered_kind: "territory" | "symbol" | "wild";
  offered_territory_id: number | null;
  offered_symbol: "leaf" | "gold" | "water" | null;
  requested_kind: "territory" | "symbol" | "wild";
  requested_territory_id: number | null;
  requested_symbol: "leaf" | "gold" | "water" | null;
  status: "open" | "countered" | "accepted_pending_selection";
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

type TradePlayerProjection = {
  trade_signals_used: number;
};

type CardProjection = {
  id: string;
  territory_id: number | null;
  symbol: "leaf" | "gold" | "water" | null;
  is_wild: boolean;
};

function descriptor(
  kind: "territory" | "symbol" | "wild" | null,
  territoryId: number | null,
  symbol: "leaf" | "gold" | "water" | null,
): TradeCardDescriptor {
  if (kind === "wild") return { kind: "wild" };
  if (kind === "territory" && territoryId !== null) {
    return { kind: "territory", territoryId };
  }
  if (kind === "symbol" && symbol !== null) {
    return { kind: "symbol", symbol };
  }
  throw new RoomError("Negociação possui descritor inválido.", 500);
}

function originalTerms(offer: TradeOfferProjection): GameTradeTerms {
  return {
    offered: descriptor(
      offer.offered_kind,
      offer.offered_territory_id,
      offer.offered_symbol,
    ),
    requested: descriptor(
      offer.requested_kind,
      offer.requested_territory_id,
      offer.requested_symbol,
    ),
  };
}

function counterTerms(offer: TradeOfferProjection): GameTradeTerms | null {
  if (!offer.counter_offered_kind || !offer.counter_requested_kind) return null;
  return {
    offered: descriptor(
      offer.counter_offered_kind,
      offer.counter_offered_territory_id,
      offer.counter_offered_symbol,
    ),
    requested: descriptor(
      offer.counter_requested_kind,
      offer.counter_requested_territory_id,
      offer.counter_requested_symbol,
    ),
  };
}

function publicOffer(offer: TradeOfferProjection): GameTradeOffer {
  const counter = counterTerms(offer);
  return {
    id: offer.id,
    proposerPlayerId: offer.proposer_player_id,
    targetPlayerId: offer.target_player_id,
    status: offer.status,
    original: originalTerms(offer),
    counter:
      counter && offer.responder_player_id
        ? {
            proposerPlayerId: offer.responder_player_id,
            terms: counter,
          }
        : null,
  };
}

function pendingSelection(
  offer: TradeOfferProjection | null,
  playerId: string,
): GameTradePrivateState["myPendingSelection"] {
  if (
    !offer ||
    offer.status !== "accepted_pending_selection" ||
    !offer.responder_player_id ||
    !offer.accepted_terms
  ) {
    return null;
  }

  const original = originalTerms(offer);
  const counter = counterTerms(offer);
  const proposerDescriptor =
    offer.accepted_terms === "original"
      ? original.offered
      : counter?.requested ?? null;
  const responderDescriptor =
    offer.accepted_terms === "original"
      ? original.requested
      : counter?.offered ?? null;

  if (
    playerId === offer.proposer_player_id &&
    !offer.proposer_selected_card_id &&
    proposerDescriptor
  ) {
    return { offerId: offer.id, descriptor: proposerDescriptor };
  }
  if (
    playerId === offer.responder_player_id &&
    !offer.responder_selected_card_id &&
    responderDescriptor
  ) {
    return { offerId: offer.id, descriptor: responderDescriptor };
  }
  return null;
}

async function readRoom(client: PoolClient, roomId: string) {
  const room = (
    await client.query<TradeRoomProjection>(
      `SELECT status,phase,reinforcements_remaining,trade_offers_used
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function readActiveOffer(client: PoolClient, roomId: string) {
  return (
    await client.query<TradeOfferProjection>(
      `SELECT id,proposer_player_id,target_player_id,
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
       LIMIT 1`,
      [roomId],
    )
  ).rows[0] ?? null;
}

export async function readTradePublicState(
  client: PoolClient,
  roomId: string,
): Promise<{
  room: Pick<GameCommandPatch, "room">["room"];
  trade: GameTradePublicState | null;
}> {
  const room = await readRoom(client, roomId);
  const inTrade = room.status === "playing" && room.phase === "trade";
  const offer = inTrade ? await readActiveOffer(client, roomId) : null;

  return {
    room: {
      phase: room.phase as NonNullable<Pick<GameCommandPatch, "room">["room"]>["phase"],
      reinforcementsRemaining: room.reinforcements_remaining,
    },
    trade: inTrade
      ? {
          offersUsed: room.trade_offers_used,
          offerLimit: PLAYER_TRADE_OFFER_LIMIT,
          activeOffer: offer ? publicOffer(offer) : null,
        }
      : null,
  };
}

export async function readTradePrivatePatch(
  client: PoolClient,
  roomId: string,
  playerId: string,
): Promise<GamePrivatePatch> {
  const [room, playerResult, cardsResult] = await Promise.all([
    readRoom(client, roomId),
    client.query<TradePlayerProjection>(
      `SELECT trade_signals_used
       FROM room_players
       WHERE room_id=$1 AND id=$2`,
      [roomId, playerId],
    ),
    client.query<CardProjection>(
      `SELECT id,territory_id,symbol,is_wild
       FROM game_cards
       WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'
       ORDER BY id`,
      [roomId, playerId],
    ),
  ]);

  const player = playerResult.rows[0];
  if (!player) throw new RoomError("Jogador não pertence à partida.", 403);

  const cards: GameCard[] = cardsResult.rows.map((card) => ({
    id: card.id,
    territoryId: card.territory_id,
    symbol: card.is_wild ? "wild" : card.symbol!,
  }));

  if (room.status !== "playing" || room.phase !== "trade") {
    return { myCards: cards };
  }

  const offer = await readActiveOffer(client, roomId);
  return {
    myCards: cards,
    trade: {
      signalsUsed: player.trade_signals_used,
      signalLimit: PLAYER_TRADE_SIGNAL_LIMIT,
      myPendingSelection: pendingSelection(offer, playerId),
    },
  };
}

async function tradeParticipantIds(
  client: PoolClient,
  roomId: string,
  offerId: string,
) {
  const offer = (
    await client.query<{
      proposer_player_id: string;
      target_player_id: string;
    }>(
      `SELECT proposer_player_id,target_player_id
       FROM game_player_trade_offers
       WHERE room_id=$1 AND id=$2`,
      [roomId, offerId],
    )
  ).rows[0];
  if (!offer) return [];
  return [...new Set([offer.proposer_player_id, offer.target_player_id])];
}

function requiresPrivateProjection(action: unknown) {
  return action === "accept" || action === "acceptCounter" || action === "selectCard";
}

export async function buildTradeCommandSyncEffects(
  client: PoolClient,
  roomId: string,
  input: Record<string, unknown>,
) {
  const projection = await readTradePublicState(client, roomId);
  const publicPatch: GameCommandPatch = {
    room: projection.room,
    trade: projection.trade,
  };

  if (!requiresPrivateProjection(input.action) || typeof input.offerId !== "string") {
    return { publicPatch, privatePatches: [] };
  }

  const playerIds = await tradeParticipantIds(client, roomId, input.offerId);
  const privatePatches = [] as Array<{
    playerId: string;
    patch: GamePrivatePatch;
  }>;
  for (const playerId of playerIds) {
    privatePatches.push({
      playerId,
      patch: await readTradePrivatePatch(client, roomId, playerId),
    });
  }

  return { publicPatch, privatePatches };
}

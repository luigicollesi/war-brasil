"use client";

import { useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { runGameCommand } from "@/src/lib/client/game-command-client";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import { cardsMatchingTradeDescriptor } from "@/src/lib/shared/game-trade-rules";
import { TradeBuilderModal } from "./trade-builder-modal";
import { TradeNegotiationSummary } from "./trade-negotiation-summary";
import { tradePlayerName } from "./trade-ui-helpers";

type TradeResponseModalProps = {
  roomId: string;
  snapshot: GameSnapshot;
  onRefresh: (minimumRevision?: number) => Promise<void>;
};

export function TradeResponseModal({
  roomId,
  snapshot,
  onRefresh,
}: TradeResponseModalProps) {
  const trade = snapshot.trade;
  const me = snapshot.players.find((player) => player.isMe);
  const offer = trade?.activeOffer ?? null;
  const [counterOpen, setCounterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const incomingOffer = Boolean(
    snapshot.room.status === "playing" &&
      snapshot.room.phase === "trade" &&
      me &&
      offer &&
      offer.status === "open" &&
      offer.targetPlayerId === me.id,
  );

  if (!incomingOffer || !offer) return null;

  const canAccept =
    cardsMatchingTradeDescriptor(snapshot.myCards, offer.original.requested)
      .length > 0;

  async function command(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");

    try {
      const result = await runGameCommand(roomId, "trade", body);
      await onRefresh(result.revision ?? undefined);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível responder à oferta.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (counterOpen) {
    return (
      <TradeBuilderModal
        mode="counter"
        snapshot={snapshot}
        offerId={offer.id}
        onClose={() => setCounterOpen(false)}
        onSubmit={command}
      />
    );
  }

  return (
    <GameModal
      eyebrow="Oferta recebida"
      title={`${tradePlayerName(snapshot, offer.proposerPlayerId)} propôs uma troca`}
      className="trade-modal w-full max-w-lg p-5 sm:p-6"
    >
      <p className="mt-2 text-sm text-[#b9cbc3]">
        Analise os termos antes de responder.
      </p>

      <div className="mt-5">
        <TradeNegotiationSummary label="Termos da oferta" terms={offer.original} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {canAccept ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void command({ action: "accept", offerId: offer.id })
            }
            className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
          >
            Aceitar
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => setCounterOpen(true)}
          className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
        >
          Contraofertar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void command({ action: "decline", offerId: offer.id })
          }
          className="rounded-xl border border-[#b65a4c]/30 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
        >
          Recusar
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[#f0a090]" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

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
};

function pendingLabel(action: string | null) {
  if (action === "accept" || action === "acceptCounter") {
    return "Confirmando troca...";
  }
  if (action === "decline") return "Recusando oferta...";
  if (action === "counter") return "Enviando contraoferta...";
  return action ? "Processando resposta..." : "";
}

export function TradeResponseModal({
  roomId,
  snapshot,
}: TradeResponseModalProps) {
  const trade = snapshot.trade;
  const me = snapshot.players.find((player) => player.isMe);
  const offer = trade?.activeOffer ?? null;
  const counter = offer?.counter ?? null;
  const [counterOpen, setCounterOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const incomingOffer = Boolean(
    snapshot.room.status === "playing" &&
      snapshot.room.phase === "trade" &&
      me &&
      offer &&
      offer.status === "open" &&
      offer.targetPlayerId === me.id,
  );
  const incomingCounter = Boolean(
    snapshot.room.status === "playing" &&
      snapshot.room.phase === "trade" &&
      me &&
      offer &&
      counter &&
      offer.status === "countered" &&
      offer.proposerPlayerId === me.id,
  );

  if ((!incomingOffer && !incomingCounter) || !offer || !me) return null;

  const canAcceptOriginal =
    cardsMatchingTradeDescriptor(snapshot.myCards, offer.original.requested)
      .length > 0;
  const canAcceptCounter = Boolean(
    counter &&
      cardsMatchingTradeDescriptor(snapshot.myCards, counter.terms.requested)
        .length > 0,
  );

  async function command(body: Record<string, unknown>) {
    if (busyAction) return false;
    const action = typeof body.action === "string" ? body.action : "trade";
    setBusyAction(action);
    setError("");

    try {
      await runGameCommand(roomId, "trade", body);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível responder à negociação.",
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  if (incomingOffer && counterOpen) {
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

  if (incomingCounter && counter) {
    return (
      <GameModal
        eyebrow="Contraoferta recebida"
        title={`${tradePlayerName(snapshot, counter.proposerPlayerId)} enviou novos termos`}
        className="trade-modal w-full max-w-lg p-5 sm:p-6"
      >
        <p className="mt-2 text-sm text-[#b9cbc3]">
          Você pode aceitar estes termos ou encerrar esta negociação.
        </p>

        <div className="mt-5 space-y-3">
          <TradeNegotiationSummary label="Sua oferta original" terms={offer.original} />
          <TradeNegotiationSummary label="Contraoferta recebida" terms={counter.terms} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {canAcceptCounter ? (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() =>
                void command({ action: "acceptCounter", offerId: offer.id })
              }
              className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
            >
              Aceitar contraoferta
            </button>
          ) : null}
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              void command({ action: "decline", offerId: offer.id })
            }
            className="rounded-xl border border-[#b65a4c]/30 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
          >
            Recusar
          </button>
        </div>

        {busyAction ? (
          <p className="mt-4 text-sm text-[#f1d278]" role="status" aria-live="polite">
            {pendingLabel(busyAction)}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-[#f0a090]" role="alert">
            {error}
          </p>
        ) : null}
      </GameModal>
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
        {canAcceptOriginal ? (
          <button
            type="button"
            disabled={busyAction !== null}
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
          disabled={busyAction !== null}
          onClick={() => setCounterOpen(true)}
          className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
        >
          Contraofertar
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() =>
            void command({ action: "decline", offerId: offer.id })
          }
          className="rounded-xl border border-[#b65a4c]/30 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
        >
          Recusar
        </button>
      </div>

      {busyAction ? (
        <p className="mt-4 text-sm text-[#f1d278]" role="status" aria-live="polite">
          {pendingLabel(busyAction)}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#f0a090]" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

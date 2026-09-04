"use client";

import { useState } from "react";
import { runGameCommand } from "@/src/lib/client/game-command-client";
import { sendTradeSignal } from "@/src/lib/client/game-trade-client";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import {
  cardsMatchingTradeDescriptor,
  type TradeCardDescriptor,
} from "@/src/lib/shared/game-trade-rules";
import {
  TradeBuilderModal,
  type TradeBuilderMode,
} from "./trade-builder-modal";
import { TradeCardSelectionModal } from "./trade-card-selection-modal";
import { TradeNegotiationSummary } from "./trade-negotiation-summary";
import { TradeSignalModal } from "./trade-signal-modal";
import { tradePlayerName } from "./trade-ui-helpers";

type TradePhasePanelProps = {
  roomId: string;
  snapshot: GameSnapshot;
  onRefresh: (minimumRevision?: number) => Promise<void>;
};

export function TradePhasePanel({
  roomId,
  snapshot,
  onRefresh,
}: TradePhasePanelProps) {
  const trade = snapshot.trade;
  const me = snapshot.players.find((player) => player.isMe);
  const [builder, setBuilder] = useState<TradeBuilderMode | null>(null);
  const [signalOpen, setSignalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localSignalsUsed, setLocalSignalsUsed] = useState(trade?.signalsUsed ?? 0);

  if (!trade || !me) return null;

  const isTurn = snapshot.room.currentPlayerId === me.id;
  const activeOffer = trade.activeOffer;
  const counter = activeOffer?.counter ?? null;
  const remainingOffers = Math.max(0, trade.offerLimit - trade.offersUsed);
  const effectiveSignalsUsed = Math.max(localSignalsUsed, trade.signalsUsed);
  const remainingSignals = Math.max(0, trade.signalLimit - effectiveSignalsUsed);
  const isTarget = activeOffer?.targetPlayerId === me.id;
  const isOriginalProposer = activeOffer?.proposerPlayerId === me.id;
  const eligibleTargets = snapshot.players.filter(
    (player) =>
      player.id !== me.id && !player.isBot && player.turnPosition !== null,
  );
  const canAcceptOriginal = Boolean(
    activeOffer &&
      activeOffer.status === "open" &&
      cardsMatchingTradeDescriptor(
        snapshot.myCards,
        activeOffer.original.requested,
      ).length > 0,
  );
  const canAcceptCounter = Boolean(
    activeOffer &&
      counter &&
      activeOffer.status === "countered" &&
      cardsMatchingTradeDescriptor(snapshot.myCards, counter.terms.requested)
        .length > 0,
  );
  const canSignal =
    !isTurn &&
    !me.isBot &&
    me.turnPosition !== null &&
    snapshot.myCards.length > 0 &&
    remainingSignals > 0;

  async function command(body: Record<string, unknown>) {
    setMessage("");
    const action = typeof body.action === "string" ? body.action : "trade";
    setBusyAction(action);
    try {
      const result = await runGameCommand(roomId, "trade", body);
      await onRefresh(result.revision ?? undefined);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a negociação.",
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function signal(descriptor: TradeCardDescriptor) {
    setMessage("");
    try {
      const result = await sendTradeSignal(roomId, descriptor);
      setLocalSignalsUsed(result.signalsUsed);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a sinalização.",
      );
      return false;
    }
  }

  return (
    <div className="trade-phase-panel mt-5 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9b650]">
          Fase de troca
        </p>
        <h3 className="mt-1 text-base font-semibold text-white">
          Negocie cartas ou siga direto para os reforços.
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isTurn ? (
          <>
            <span className="rounded-full border border-[#e4b94f]/25 bg-[#e4b94f]/10 px-3 py-1 text-xs font-semibold text-[#f1d278]">
              {remainingOffers}{" "}
              {remainingOffers === 1 ? "oferta restante" : "ofertas restantes"}
            </span>
            {!activeOffer && remainingOffers > 0 && eligibleTargets.length > 0 ? (
              <button
                type="button"
                onClick={() => setBuilder("offer")}
                className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]"
              >
                Solicitar troca
              </button>
            ) : null}
            <button
              type="button"
              disabled={Boolean(activeOffer) || busyAction !== null}
              onClick={() => void command({ action: "finish" })}
              className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
            >
              Iniciar reforços
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-[#b9cbc3]">
              Negociações de{" "}
              {tradePlayerName(snapshot, snapshot.room.currentPlayerId ?? "")}.
            </span>
            {canSignal ? (
              <button
                type="button"
                onClick={() => setSignalOpen(true)}
                className="rounded-xl border border-[#e4b94f]/30 bg-[#e4b94f]/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f1d278]"
              >
                Notificar posse · {remainingSignals}
              </button>
            ) : null}
          </>
        )}
      </div>

      {isTurn && eligibleTargets.length === 0 && !activeOffer ? (
        <p className="text-xs text-[#9eb0a8]">
          Não há outro jogador humano ativo disponível para negociação.
        </p>
      ) : null}

      {activeOffer ? (
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9b650]">
                Negociação pública
              </p>
              <p className="mt-1 text-sm text-[#dce7e1]">
                {tradePlayerName(snapshot, activeOffer.proposerPlayerId)} →{" "}
                {tradePlayerName(snapshot, activeOffer.targetPlayerId)}
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9eb0a8]">
              {activeOffer.status === "open"
                ? "Aguardando resposta"
                : activeOffer.status === "countered"
                  ? "Contraoferta"
                  : "Troca aceita"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <TradeNegotiationSummary
              label={`Oferta de ${tradePlayerName(snapshot, activeOffer.proposerPlayerId)}`}
              terms={activeOffer.original}
            />
            {counter ? (
              <TradeNegotiationSummary
                label={`Contraoferta de ${tradePlayerName(snapshot, counter.proposerPlayerId)}`}
                terms={counter.terms}
              />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {activeOffer.status === "open" && isTarget ? (
              <>
                {canAcceptOriginal ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void command({ action: "accept", offerId: activeOffer.id })
                    }
                    className="rounded-xl bg-[#e4b94f] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
                  >
                    Aceitar
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setBuilder("counter")}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
                >
                  Contraofertar
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void command({ action: "decline", offerId: activeOffer.id })
                  }
                  className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
                >
                  Recusar
                </button>
              </>
            ) : null}

            {activeOffer.status === "open" && isOriginalProposer ? (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  void command({ action: "cancel", offerId: activeOffer.id })
                }
                className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
              >
                Cancelar oferta
              </button>
            ) : null}

            {activeOffer.status === "countered" &&
            isOriginalProposer &&
            counter ? (
              <>
                {canAcceptCounter ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void command({
                        action: "acceptCounter",
                        offerId: activeOffer.id,
                      })
                    }
                    className="rounded-xl bg-[#e4b94f] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
                  >
                    Aceitar contraoferta
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void command({ action: "decline", offerId: activeOffer.id })
                  }
                  className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
                >
                  Recusar
                </button>
              </>
            ) : null}
          </div>

          {activeOffer.status === "accepted_pending_selection" &&
          !trade.myPendingSelection ? (
            <p className="mt-4 text-sm text-[#b9cbc3]">
              Troca aceita. Aguardando a seleção privada da carta necessária.
            </p>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[#f0a090]" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      {builder ? (
        <TradeBuilderModal
          mode={builder}
          snapshot={snapshot}
          offerId={activeOffer?.id}
          onClose={() => setBuilder(null)}
          onSubmit={command}
        />
      ) : null}

      {signalOpen ? (
        <TradeSignalModal
          snapshot={snapshot}
          onClose={() => setSignalOpen(false)}
          onSignal={signal}
        />
      ) : null}

      <TradeCardSelectionModal snapshot={snapshot} onSubmit={command} />
    </div>
  );
}

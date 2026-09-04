"use client";

import { useMemo, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { TerritoryCard } from "@/src/components/territory-card";
import { TradePhaseMount } from "@/src/components/trade/trade-phase-mount";
import { TradeResponseModal } from "@/src/components/trade/trade-response-modal";
import { runGameCommand } from "@/src/lib/game-command-client";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { isValidTrade } from "@/src/lib/game-rules";

type MandatoryCardTradeModalProps = {
  roomId: string;
  snapshot: GameSnapshot;
  onRefresh: (minimumRevision?: number) => Promise<void>;
};

export function MandatoryCardTradeModal({
  roomId,
  snapshot,
  onRefresh,
}: MandatoryCardTradeModalProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const me = snapshot.players.find((player) => player.isMe);
  const active = Boolean(
    snapshot.room.status === "playing" &&
      snapshot.room.phase === "reinforcement" &&
      me &&
      snapshot.room.currentPlayerId === me.id &&
      snapshot.myCards.length >= 5,
  );

  const selected = useMemo(
    () => snapshot.myCards.filter((card) => selectedCards.includes(card.id)),
    [selectedCards, snapshot.myCards],
  );
  const valid =
    selected.length === 3 && isValidTrade(selected.map((card) => card.symbol));

  if (
    snapshot.room.status === "playing" &&
    snapshot.room.phase === "trade" &&
    snapshot.trade
  ) {
    return (
      <>
        <TradePhaseMount
          roomId={roomId}
          snapshot={snapshot}
          onRefresh={onRefresh}
        />
        <TradeResponseModal
          roomId={roomId}
          snapshot={snapshot}
          onRefresh={onRefresh}
        />
      </>
    );
  }

  if (!active) return null;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const result = await runGameCommand(roomId, "cards/trade", {
        cardIds: selectedCards,
      });
      await onRefresh(result.revision ?? undefined);
      setSelectedCards([]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível realizar a troca.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GameModal
      eyebrow="Troca obrigatória"
      title="Troca de cartas"
      className="game-card-modal w-full max-w-lg p-6"
    >
      <p className="mt-2 text-sm text-[#64756f]">
        Troca de cartas por reforço obrigatória: limite de mais de quatro cartas.
      </p>

      <div className="mt-5 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
        {snapshot.myCards.map((card) => (
          <TerritoryCard
            key={card.id}
            territoryId={card.territoryId}
            symbol={card.symbol}
            selected={selectedCards.includes(card.id)}
            onClick={() =>
              setSelectedCards((cards) =>
                cards.includes(card.id)
                  ? cards.filter((id) => id !== card.id)
                  : cards.length < 3
                    ? [...cards, card.id]
                    : cards,
              )
            }
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || submitting}
        onClick={() => void submit()}
        className="game-primary-action mt-5 w-full rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
      >
        {submitting ? "PROCESSANDO…" : "Confirmar troca"}
      </button>

      {error ? (
        <p className="mt-3 text-sm text-[#a33c33]" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

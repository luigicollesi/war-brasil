"use client";

import { useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { TerritoryCard } from "@/src/components/territory-card";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import { cardsMatchingTradeDescriptor } from "@/src/lib/shared/game-trade-rules";
import { tradeDescriptorLabel } from "./trade-ui-helpers";

export function TradeCardSelectionModal({
  snapshot,
  onSubmit,
}: {
  snapshot: GameSnapshot;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const pending = snapshot.trade?.myPendingSelection;
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  if (!pending) return null;

  const cards = cardsMatchingTradeDescriptor(snapshot.myCards, pending.descriptor);

  return (
    <GameModal
      eyebrow="Troca aceita"
      title={`Escolha sua carta ${tradeDescriptorLabel(pending.descriptor)}`}
      className="trade-modal w-full max-w-xl p-5 sm:p-6"
    >
      <p className="mt-2 text-sm text-[#b8cac2]">
        A negociação já foi aceita. Escolha qual carta será entregue para concluir a troca.
      </p>
      <div className="mt-5 grid max-h-[58dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={submittingId !== null ? "pointer-events-none opacity-50" : ""}
          >
            <TerritoryCard
              territoryId={card.territoryId}
              symbol={card.symbol}
              onClick={() => {
                if (submittingId !== null) return;
                setSubmittingId(card.id);
                void onSubmit({
                  action: "selectCard",
                  offerId: pending.offerId,
                  cardId: card.id,
                }).finally(() => setSubmittingId(null));
              }}
            />
          </div>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-[#f0a090]" role="alert">
          Sua mão mudou e não há mais uma carta compatível. Atualize a partida para recuperar o estado.
        </p>
      ) : null}
    </GameModal>
  );
}

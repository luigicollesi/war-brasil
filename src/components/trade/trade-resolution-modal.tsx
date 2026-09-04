"use client";

import { useEffect, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { subscribeTradeResolution } from "@/src/lib/client/game-realtime-ephemeral-bus";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { GameTradeResolutionEvent } from "@/src/lib/shared/game-realtime-contract";
import { tradePlayerName } from "./trade-ui-helpers";

export function TradeResolutionModal({
  roomId,
  snapshot,
}: {
  roomId: string;
  snapshot: GameSnapshot;
}) {
  const me = snapshot.players.find((player) => player.isMe);
  const [event, setEvent] = useState<GameTradeResolutionEvent | null>(null);

  useEffect(() => {
    if (!me) return;
    return subscribeTradeResolution(roomId, (nextEvent) => {
      if (nextEvent.payload.recipientPlayerId !== me.id) return;
      if (nextEvent.payload.turnNumber !== snapshot.room.turnNumber) return;
      setEvent(nextEvent);
    });
  }, [me, roomId, snapshot.room.turnNumber]);

  if (!event) return null;

  const actorName = tradePlayerName(snapshot, event.payload.actorPlayerId);
  const counterDeclined = event.payload.outcome === "counter_declined";

  return (
    <GameModal
      eyebrow="Negociação encerrada"
      title={counterDeclined ? "Contraoferta recusada" : "Oferta recusada"}
      onClose={() => setEvent(null)}
      className="trade-modal w-full max-w-sm p-5 sm:p-6"
    >
      <p className="mt-3 text-sm leading-6 text-[#c8d9d1]">
        {counterDeclined
          ? `${actorName} recusou sua contraoferta.`
          : `${actorName} recusou sua oferta de troca.`}
      </p>

      <button
        type="button"
        onClick={() => setEvent(null)}
        className="mt-6 w-full rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]"
      >
        Entendi
      </button>
    </GameModal>
  );
}

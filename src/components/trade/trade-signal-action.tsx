"use client";

import { useState } from "react";
import { sendTradeSignal } from "@/src/lib/client/game-trade-client";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { TradeCardDescriptor } from "@/src/lib/shared/game-trade-rules";
import { TradeSignalModal } from "./trade-signal-modal";

export function TradeSignalAction({
  roomId,
  snapshot,
}: {
  roomId: string;
  snapshot: GameSnapshot;
}) {
  const trade = snapshot.trade;
  const me = snapshot.players.find((player) => player.isMe);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [localSignalsUsed, setLocalSignalsUsed] = useState(trade?.signalsUsed ?? 0);

  if (!trade || !me) return null;

  const effectiveSignalsUsed = Math.max(localSignalsUsed, trade.signalsUsed);
  const remainingSignals = Math.max(0, trade.signalLimit - effectiveSignalsUsed);
  const canSignal =
    snapshot.room.status === "playing" &&
    snapshot.room.phase === "trade" &&
    snapshot.room.currentPlayerId !== me.id &&
    !me.isBot &&
    me.turnPosition !== null &&
    snapshot.myCards.length > 0 &&
    remainingSignals > 0;

  if (!canSignal) return null;

  async function signal(descriptor: TradeCardDescriptor) {
    setError("");
    try {
      const result = await sendTradeSignal(roomId, descriptor);
      setLocalSignalsUsed(result.signalsUsed);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível enviar a sinalização.",
      );
      return false;
    }
  }

  return (
    <>
      <div className="fixed bottom-24 right-4 z-[70] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {error ? (
          <p
            className="max-w-xs rounded-xl border border-[#b65a4c]/30 bg-[#301d1a] px-3 py-2 text-xs text-[#f2a99d] shadow-lg"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-[#e4b94f]/35 bg-[#17372d] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f1d278] shadow-xl"
          data-trade-signal-action
        >
          Notificar posse · {remainingSignals}
        </button>
      </div>

      {open ? (
        <TradeSignalModal
          snapshot={snapshot}
          onClose={() => setOpen(false)}
          onSignal={signal}
        />
      ) : null}
    </>
  );
}

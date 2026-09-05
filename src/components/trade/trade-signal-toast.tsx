"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeTradeSignal } from "@/src/lib/client/game-realtime-ephemeral-bus";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { GameTradeSignalEvent } from "@/src/lib/shared/game-realtime-contract";
import { TERRITORY_METADATA } from "@/src/lib/shared/game-config";

function signalLabel(event: GameTradeSignalEvent) {
  const descriptor = event.payload.card;
  if (descriptor.kind === "wild") return "um Coringa";
  if (descriptor.kind === "symbol") {
    if (descriptor.symbol === "leaf") return "uma carta Folha";
    if (descriptor.symbol === "gold") return "uma carta Ouro";
    return "uma carta Água";
  }
  return (
    TERRITORY_METADATA[descriptor.territoryId]?.name ??
    `Território ${descriptor.territoryId}`
  );
}

export function TradeSignalToast({
  roomId,
  snapshot,
}: {
  roomId: string;
  snapshot: GameSnapshot;
}) {
  const [queue, setQueue] = useState<GameTradeSignalEvent[]>([]);
  const currentTurnRef = useRef(snapshot.room.turnNumber);
  currentTurnRef.current = snapshot.room.turnNumber;
  const event = queue[0] ?? null;

  useEffect(() => {
    return subscribeTradeSignal(roomId, (nextEvent) => {
      // Cada cliente pode receber o broadcast antes de seu snapshot HTTP alcançar
      // a fase de troca. Só descartamos eventos comprovadamente antigos.
      if (nextEvent.payload.turnNumber < currentTurnRef.current) return;
      setQueue((current) => [...current, nextEvent]);
    });
  }, [roomId]);

  useEffect(() => {
    if (!event) return;
    const timeoutId = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [event]);

  if (!event) return null;

  const player = snapshot.players.find(
    (candidate) => candidate.id === event.payload.playerId,
  );

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-20 z-[90] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-[#e4b94f]/30 bg-[#071f19]/95 px-5 py-4 text-center text-white shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9b650]">
        Notificação de posse
      </p>
      <p className="mt-1 text-sm">
        <strong>{player?.factionName ?? "Um jogador"}</strong> sinalizou possuir
      </p>
      <p className="mt-1 text-base font-semibold text-[#f5dda0]">
        {signalLabel(event)}
      </p>
    </div>
  );
}

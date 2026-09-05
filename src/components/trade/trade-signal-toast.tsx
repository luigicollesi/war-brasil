"use client";

import { useEffect, useRef, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { subscribeTradeSignal } from "@/src/lib/client/game-realtime-ephemeral-bus";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { GameTradeSignalEvent } from "@/src/lib/shared/game-realtime-contract";
import { TERRITORY_METADATA } from "@/src/lib/shared/game-config";

function signalLabel(event: GameTradeSignalEvent) {
  const descriptor = event.payload.card;
  if (descriptor.kind === "wild") return "Coringa";
  if (descriptor.kind === "symbol") {
    if (descriptor.symbol === "leaf") return "Carta Folha";
    if (descriptor.symbol === "gold") return "Carta Ouro";
    return "Carta Água";
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
  const event = queue[0] ?? null;

  useEffect(() => {
    currentTurnRef.current = snapshot.room.turnNumber;
  }, [snapshot.room.turnNumber]);

  useEffect(() => {
    return subscribeTradeSignal(roomId, (nextEvent) => {
      if (nextEvent.payload.turnNumber < currentTurnRef.current) return;
      setQueue((current) => [...current, nextEvent]);
    });
  }, [roomId]);

  if (!event) return null;

  const player = snapshot.players.find(
    (candidate) => candidate.id === event.payload.playerId,
  );

  return (
    <GameModal
      eyebrow="Notificação de posse"
      title="Carta disponível para troca"
      className="w-full max-w-md p-6"
    >
      <p className="mt-3 text-sm text-[#64756f]">
        <strong className="text-[#17372d]">
          {player?.factionName ?? "Um jogador"}
        </strong>{" "}
        sinalizou possuir:
      </p>

      <div className="mt-4 rounded-2xl border border-[#e4b94f]/30 bg-[#17372d]/5 px-4 py-5 text-center">
        <p className="text-lg font-semibold text-[#17372d]">
          {signalLabel(event)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setQueue((current) => current.slice(1))}
        className="game-primary-action mt-5 w-full rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]"
      >
        Entendi
      </button>
    </GameModal>
  );
}

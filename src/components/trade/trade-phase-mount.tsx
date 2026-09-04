"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import { TradePhasePanel } from "./trade-phase-panel";
import { TradeSignalAction } from "./trade-signal-action";
import { TradeSignalToast } from "./trade-signal-toast";

export function TradePhaseMount({
  roomId,
  snapshot,
  onRefresh,
}: {
  roomId: string;
  snapshot: GameSnapshot;
  onRefresh: (minimumRevision?: number) => Promise<void>;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const scopeKey = `${snapshot.room.turnNumber}:${snapshot.room.currentPlayerId ?? "-"}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTarget(document.querySelector<HTMLElement>(".game-map-canvas + section"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {target
        ? createPortal(
            <TradePhasePanel
              key={scopeKey}
              roomId={roomId}
              snapshot={snapshot}
              onRefresh={onRefresh}
            />,
            target,
          )
        : null}
      <TradeSignalAction key={`signal:${scopeKey}`} roomId={roomId} snapshot={snapshot} />
      <TradeSignalToast key={scopeKey} roomId={roomId} snapshot={snapshot} />
    </>
  );
}

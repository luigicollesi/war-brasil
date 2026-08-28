"use client";

import { useMemo, useState } from "react";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { buildTemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

export function useTemporalAnomaly(snapshot: GameSnapshot) {
  const presentation = useMemo(
    () =>
      buildTemporalAnomalyPresentation({
        roundNumber: snapshot.room.roundNumber,
        jurassicTunnelDestinationId:
          snapshot.room.jurassicTunnelDestinationId,
        activeEvent: snapshot.room.activeEvent,
      }),
    [
      snapshot.room.activeEvent,
      snapshot.room.jurassicTunnelDestinationId,
      snapshot.room.roundNumber,
    ],
  );
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const activeKey =
    snapshot.room.status === "playing" ? (presentation?.key ?? null) : null;

  return {
    presentation,
    isOpen: Boolean(activeKey && dismissedKey !== activeKey),
    open: () => {
      if (activeKey) setDismissedKey(null);
    },
    close: () => {
      if (activeKey) setDismissedKey(activeKey);
    },
  };
}

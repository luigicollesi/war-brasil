"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const lastPresentedKey = useRef<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!presentation || snapshot.room.status !== "playing") {
      if (!presentation) setOpenKey(null);
      return;
    }

    if (lastPresentedKey.current === presentation.key) return;

    lastPresentedKey.current = presentation.key;
    setOpenKey(presentation.key);
  }, [presentation, snapshot.room.status]);

  return {
    presentation,
    isOpen: Boolean(presentation && openKey === presentation.key),
    open: () => {
      if (presentation) setOpenKey(presentation.key);
    },
    close: () => setOpenKey(null),
  };
}

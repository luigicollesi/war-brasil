"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BoardTerritory } from "@/src/components/interactive-board";
import { NORMAL_BOARD_PRESENTATION } from "@/src/lib/client/map/board-presentation";
import { MAP_BOARD_PRESENTATION_EVENT } from "@/src/lib/client/map/map-runtime-events";

function findMapSurface() {
  const board = document.querySelector<HTMLObjectElement>(".game-map-object");
  return board?.closest<HTMLElement>(".game-map-surface") ?? null;
}

export function InitialTerritoryDrawPresentation({
  territories,
  revealedTerritoryIds,
  highlightPlayerId,
  highlightOn,
  presentationStartedAt,
  tick,
}: {
  territories: readonly BoardTerritory[];
  revealedTerritoryIds: ReadonlySet<number>;
  highlightPlayerId: string | null;
  highlightOn: boolean;
  presentationStartedAt: string;
  tick: number;
}) {
  const lastSignatureRef = useRef("");
  const territoryIds = useMemo(
    () => new Set(territories.map((territory) => territory.territoryId)),
    [territories],
  );

  useEffect(() => {
    const surface = findMapSurface();
    if (!surface) return;

    const startedAtMs = Date.parse(presentationStartedAt);
    const titleVisible = Number.isFinite(startedAtMs) && tick < startedAtMs;
    const revealed = new Set(
      [...revealedTerritoryIds].filter((territoryId) => territoryIds.has(territoryId)),
    );
    const signature = [
      titleVisible ? 1 : 0,
      highlightOn ? 1 : 0,
      highlightPlayerId ?? "",
      [...revealed].join(","),
    ].join("|");

    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;

    surface.dispatchEvent(
      new CustomEvent(MAP_BOARD_PRESENTATION_EVENT, {
        detail: {
          mode: "initial-territory-draw",
          revealedTerritoryIds: revealed,
          highlightPlayerId,
          highlightOn,
          titleVisible,
        },
      }),
    );
  }, [
    highlightOn,
    highlightPlayerId,
    presentationStartedAt,
    revealedTerritoryIds,
    territoryIds,
    tick,
  ]);

  useEffect(
    () => () => {
      const surface = findMapSurface();
      if (!surface) return;
      surface.dispatchEvent(
        new CustomEvent(MAP_BOARD_PRESENTATION_EVENT, {
          detail: NORMAL_BOARD_PRESENTATION,
        }),
      );
    },
    [],
  );

  return null;
}

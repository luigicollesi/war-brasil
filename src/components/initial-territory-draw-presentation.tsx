"use client";

import { useEffect } from "react";
import type { BoardTerritory } from "@/src/components/interactive-board";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";

type InitialTerritoryDrawPresentationProps = {
  territories: readonly BoardTerritory[];
  revealedTerritoryIds: ReadonlySet<number>;
  highlightPlayerId: string | null;
  highlightOn: boolean;
  tick: number;
};

const NEUTRAL_TERRITORY_FILL = "#7d8582";

function colorHex(color: PlayerColor) {
  return PLAYER_COLORS.find((item) => item.value === color)?.hex ?? "#64756f";
}

function findMapSurface() {
  const board = document.querySelector<HTMLObjectElement>(".game-map-object");
  const surface = board?.closest<HTMLElement>(".game-map-surface") ?? null;
  return { board, surface };
}

function suppressMapLayers(surface: HTMLElement) {
  surface.style.pointerEvents = "none";
  surface
    .querySelectorAll<HTMLElement>(".road-network, .game-troop-layer, canvas")
    .forEach((layer) => {
      layer.style.display = "none";
    });
}

export function InitialTerritoryDrawPresentation({
  territories,
  revealedTerritoryIds,
  highlightPlayerId,
  highlightOn,
  tick,
}: InitialTerritoryDrawPresentationProps) {
  useEffect(() => {
    const { board, surface } = findMapSurface();
    if (!board || !surface) return;

    suppressMapLayers(surface);

    const mapDocument = board.contentDocument;
    const root = mapDocument?.querySelector("#territories");
    if (!root) return;

    const territoryById = new Map(
      territories.map((territory) => [territory.territoryId, territory]),
    );

    for (const path of root.querySelectorAll<SVGPathElement>("path.territory")) {
      const territoryId = Number(path.dataset.id);
      const territory = territoryById.get(territoryId);
      if (!territory) continue;

      const revealed = revealedTerritoryIds.has(territoryId);
      const highlighted = Boolean(
        revealed &&
          highlightOn &&
          highlightPlayerId &&
          territory.ownerPlayerId === highlightPlayerId,
      );

      path.style.fill = revealed
        ? colorHex(territory.ownerColor)
        : NEUTRAL_TERRITORY_FILL;
      path.style.fillOpacity = highlighted ? "0.86" : "0.55";
      path.style.filter = highlighted
        ? "brightness(1.2) drop-shadow(0 0 9px rgba(255,255,255,.72))"
        : "none";
      path.style.cursor = "default";
      path.setAttribute("tabindex", "-1");
    }
  }, [
    highlightOn,
    highlightPlayerId,
    revealedTerritoryIds,
    territories,
    tick,
  ]);

  useEffect(
    () => () => {
      const { board, surface } = findMapSurface();
      if (!board || !surface) return;

      surface.style.pointerEvents = "";
      surface
        .querySelectorAll<HTMLElement>(".road-network, .game-troop-layer, canvas")
        .forEach((layer) => {
          layer.style.display = "";
        });

      const mapDocument = board.contentDocument;
      const root = mapDocument?.querySelector("#territories");
      if (!root) return;

      const territoryById = new Map(
        territories.map((territory) => [territory.territoryId, territory]),
      );

      for (const path of root.querySelectorAll<SVGPathElement>("path.territory")) {
        const territory = territoryById.get(Number(path.dataset.id));
        if (!territory) continue;

        path.style.fill = colorHex(territory.ownerColor);
        path.style.fillOpacity = "0.55";
        path.style.filter = "none";
        path.style.cursor = "pointer";
        path.setAttribute("tabindex", "0");
      }
    },
    [territories],
  );

  return null;
}

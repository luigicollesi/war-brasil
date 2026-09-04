"use client";

import { useEffect } from "react";
import type { BoardTerritory } from "@/src/components/interactive-board";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";

type InitialTerritoryDrawPresentationProps = {
  territories: readonly BoardTerritory[];
  revealedTerritoryIds: ReadonlySet<number>;
  highlightPlayerId: string | null;
  highlightOn: boolean;
  presentationStartedAt: string;
  tick: number;
};

const NEUTRAL_TERRITORY_FILL = "#7d8582";
const TITLE_OVERLAY_SELECTOR = "[data-initial-territory-title]";

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

function syncTitleOverlay(surface: HTMLElement, visible: boolean) {
  let overlay = surface.querySelector<HTMLElement>(TITLE_OVERLAY_SELECTOR);

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.dataset.initialTerritoryTitle = "true";
    overlay.className =
      "pointer-events-none absolute inset-0 z-30 flex items-center justify-center";

    const title = document.createElement("div");
    title.className =
      "rounded-2xl border border-transparent bg-transparent px-6 py-4 text-center text-2xl font-semibold tracking-[-0.035em] text-[#17372d] sm:text-3xl";
    title.style.textShadow = "0 2px 12px rgba(250, 248, 242, 0.95)";
    title.setAttribute("role", "status");
    title.textContent = "Sorteio de Territórios";
    overlay.append(title);
    surface.append(overlay);
  }

  overlay.hidden = !visible;
}

export function InitialTerritoryDrawPresentation({
  territories,
  revealedTerritoryIds,
  highlightPlayerId,
  highlightOn,
  presentationStartedAt,
  tick,
}: InitialTerritoryDrawPresentationProps) {
  useEffect(() => {
    const { board, surface } = findMapSurface();
    if (!board || !surface) return;

    suppressMapLayers(surface);

    const startedAtMs = Date.parse(presentationStartedAt);
    syncTitleOverlay(
      surface,
      Number.isFinite(startedAtMs) && tick < startedAtMs,
    );

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
    presentationStartedAt,
    revealedTerritoryIds,
    territories,
    tick,
  ]);

  useEffect(
    () => () => {
      const { board, surface } = findMapSurface();
      if (!board || !surface) return;

      surface.querySelector(TITLE_OVERLAY_SELECTOR)?.remove();
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

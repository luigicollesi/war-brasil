"use client";

import { useEffect, useRef } from "react";
import type { BoardTerritory } from "@/src/components/interactive-board";
import {
  neutralTerritoryMaterial,
  territoryMaterial,
} from "@/src/lib/client/map/territory-material";
import {
  applyTerritoryMaterial,
  collectTerritoryVisualNodes,
} from "@/src/lib/client/map/territory-svg-nodes";
import {
  applyTerritoryOpeningHighlightState,
  ensureTerritoryRuntimeStyles,
} from "@/src/lib/client/map/territory-visual-state";

const TITLE_OVERLAY_SELECTOR = "[data-initial-territory-title]";

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

function restoreMapLayers(surface: HTMLElement) {
  surface.style.pointerEvents = "";
  surface
    .querySelectorAll<HTMLElement>(".road-network, .game-troop-layer, canvas")
    .forEach((layer) => {
      layer.style.display = "";
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

  overlay.style.display = visible ? "flex" : "none";
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
  const latestTerritoriesRef = useRef(territories);
  latestTerritoriesRef.current = territories;

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
    if (!mapDocument || !root) return;

    ensureTerritoryRuntimeStyles(mapDocument);

    const paths = Array.from(
      root.querySelectorAll<SVGPathElement>("path.territory"),
    );
    const visualNodes = collectTerritoryVisualNodes(mapDocument, paths);
    const territoryById = new Map(
      territories.map((territory) => [territory.territoryId, territory]),
    );
    const neutralMaterial = neutralTerritoryMaterial();

    for (const [territoryId, nodes] of visualNodes) {
      const territory = territoryById.get(territoryId);
      if (!territory) continue;

      const revealed = revealedTerritoryIds.has(territoryId);
      const highlighted = Boolean(
        revealed &&
          highlightOn &&
          highlightPlayerId &&
          territory.ownerPlayerId === highlightPlayerId,
      );

      applyTerritoryMaterial(
        territoryId,
        nodes,
        revealed ? territoryMaterial(territory.ownerColor) : neutralMaterial,
      );
      applyTerritoryOpeningHighlightState(nodes, highlighted);

      nodes.face.style.cursor = "default";
      nodes.face.setAttribute("tabindex", "-1");
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
      restoreMapLayers(surface);

      const mapDocument = board.contentDocument;
      const root = mapDocument?.querySelector("#territories");
      if (!mapDocument || !root) return;

      const paths = Array.from(
        root.querySelectorAll<SVGPathElement>("path.territory"),
      );
      const visualNodes = collectTerritoryVisualNodes(mapDocument, paths);
      const territoryById = new Map(
        latestTerritoriesRef.current.map((territory) => [
          territory.territoryId,
          territory,
        ]),
      );

      for (const [territoryId, nodes] of visualNodes) {
        const territory = territoryById.get(territoryId);
        if (!territory) continue;

        applyTerritoryMaterial(
          territoryId,
          nodes,
          territoryMaterial(territory.ownerColor),
        );
        applyTerritoryOpeningHighlightState(nodes, false);
        nodes.face.style.cursor = "pointer";
        nodes.face.setAttribute("tabindex", "0");
      }
    },
    [],
  );

  return null;
}

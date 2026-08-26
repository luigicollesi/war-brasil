"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";
import type { TerritoryConnection } from "@/src/lib/territory-connections";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import { JurassicTunnelConnection } from "@/src/components/jurassic-tunnel-connection";
import { RoadNetwork } from "@/src/components/road-network";
import {
  getTerritoryAnchor,
  TerritoryArrow,
  type TerritoryAnchor,
  type TerritoryArrowKind,
} from "@/src/components/territory-arrow";

export type BoardTerritory = {
  territoryId: number;
  ownerPlayerId: string;
  ownerName: string;
  ownerColor: PlayerColor;
  troops: number;
};

type TerritoryDetails = {
  id: number;
  name: string;
  region: string;
  state: string;
};

type MapArrow = {
  fromTerritoryId: number;
  toTerritoryId: number;
  kind: TerritoryArrowKind;
} | null;

type InteractiveBoardProps = {
  territories: BoardTerritory[];
  connections?: TerritoryConnection[];
  onSelect?: (territoryId: number) => void;
  selectedTerritoryId?: number | null;
  availableTerritoryIds?: number[];
  targetTerritoryIds?: number[];
  arrow?: MapArrow;
};

const ROAD_VISIBILITY_KEY = "war-brasil:roads-visible";
const regionLabels: Record<string, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

const regionBorders: Record<string, { stroke: string; glow: string }> = {
  norte: { stroke: "#55d075", glow: "rgba(85,208,117,.72)" },
  nordeste: { stroke: "#55a8ff", glow: "rgba(85,168,255,.72)" },
  "centro-oeste": { stroke: "#f4c542", glow: "rgba(244,197,66,.72)" },
  sudeste: { stroke: "#ef5555", glow: "rgba(239,85,85,.72)" },
  sul: { stroke: "#f08a35", glow: "rgba(240,138,53,.72)" },
};

const fallbackRegionBorder = {
  stroke: "#ffffff",
  glow: "rgba(255,255,255,.55)",
};

function colorHex(color: PlayerColor) {
  return PLAYER_COLORS.find((item) => item.value === color)?.hex ?? "#64756f";
}

function readTerritory(path: SVGPathElement): TerritoryDetails {
  return {
    id: Number(path.dataset.id),
    name: path.dataset.name ?? "Território",
    region: path.dataset.region ?? "",
    state: path.dataset.uf ?? "—",
  };
}

function territoryPathFromEvent(event: Event, root: Element) {
  const target = event.target as { closest?: (selector: string) => Element | null } | null;
  const path = target?.closest?.("path.territory") as SVGPathElement | null;
  return path && root.contains(path) ? path : null;
}

export function InteractiveBoard({
  territories,
  connections = [],
  onSelect,
  selectedTerritoryId,
  availableTerritoryIds = [],
  targetTerritoryIds = [],
  arrow = null,
}: InteractiveBoardProps) {
  const boardRef = useRef<HTMLObjectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pathsByIdRef = useRef(new Map<number, SVGPathElement>());
  const detailsByIdRef = useRef(new Map<number, TerritoryDetails>());
  const visualSignatureRef = useRef(new Map<number, string>());
  const cleanupBoardRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const tooltipFrameRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const [anchors, setAnchors] = useState<Map<number, TerritoryAnchor>>(new Map());
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState<number | null>(null);
  const [roadsVisible, setRoadsVisible] = useState(false);
  const territoryById = useMemo(
    () => new Map(territories.map((territory) => [territory.territoryId, territory])),
    [territories],
  );

  onSelectRef.current = onSelect;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setRoadsVisible(window.localStorage.getItem(ROAD_VISIBILITY_KEY) === "true");
      } catch {
        setRoadsVisible(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      cleanupBoardRef.current?.();
      if (tooltipFrameRef.current) cancelAnimationFrame(tooltipFrameRef.current);
    },
    [],
  );

  function scheduleTooltipPosition(event: PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    pointerRef.current = {
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
    };

    if (tooltipFrameRef.current) return;
    tooltipFrameRef.current = requestAnimationFrame(() => {
      tooltipFrameRef.current = 0;
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const { x, y } = pointerRef.current;
      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }

  function initializeBoard() {
    cleanupBoardRef.current?.();
    const mapDocument = boardRef.current?.contentDocument;
    const root = mapDocument?.querySelector("#territories");
    if (!root) return;

    const paths = Array.from(
      root.querySelectorAll<SVGPathElement>("path.territory"),
    );
    if (!paths.length) return;

    const nextPaths = new Map<number, SVGPathElement>();
    const nextDetails = new Map<number, TerritoryDetails>();
    const nextAnchors = new Map<number, TerritoryAnchor>();

    for (const path of paths) {
      const id = Number(path.dataset.id);
      nextPaths.set(id, path);
      nextDetails.set(id, readTerritory(path));
      nextAnchors.set(id, getTerritoryAnchor(path));
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", path.dataset.name ?? "Território");
      path.style.cursor = "pointer";
    }

    pathsByIdRef.current = nextPaths;
    detailsByIdRef.current = nextDetails;
    visualSignatureRef.current.clear();
    setAnchors(nextAnchors);

    const click = (event: Event) => {
      const path = territoryPathFromEvent(event, root);
      if (path) onSelectRef.current?.(Number(path.dataset.id));
    };
    const keyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      const path = territoryPathFromEvent(event, root);
      if (!path) return;
      keyboardEvent.preventDefault();
      onSelectRef.current?.(Number(path.dataset.id));
    };
    const pointerOver = (event: Event) => {
      const path = territoryPathFromEvent(event, root);
      if (!path) return;
      setHoveredTerritoryId(Number(path.dataset.id));
      scheduleTooltipPosition(event as PointerEvent);
    };
    const pointerMove = (event: Event) => {
      if (hoveredTerritoryId === null && !territoryPathFromEvent(event, root)) return;
      scheduleTooltipPosition(event as PointerEvent);
    };
    const pointerOut = (event: Event) => {
      const path = territoryPathFromEvent(event, root);
      if (!path) return;
      const related = (event as PointerEvent).relatedTarget as Node | null;
      if (related && path.contains(related)) return;
      setHoveredTerritoryId(null);
    };

    root.addEventListener("click", click);
    root.addEventListener("keydown", keyDown);
    root.addEventListener("pointerover", pointerOver);
    root.addEventListener("pointermove", pointerMove);
    root.addEventListener("pointerout", pointerOut);

    cleanupBoardRef.current = () => {
      root.removeEventListener("click", click);
      root.removeEventListener("keydown", keyDown);
      root.removeEventListener("pointerover", pointerOver);
      root.removeEventListener("pointermove", pointerMove);
      root.removeEventListener("pointerout", pointerOut);
    };
  }

  useEffect(() => {
    const available = new Set(availableTerritoryIds);
    const targets = new Set(targetTerritoryIds);

    for (const territory of territories) {
      const path = pathsByIdRef.current.get(territory.territoryId);
      if (!path) continue;

      const id = territory.territoryId;
      const isAvailable = available.has(id);
      const isTarget = targets.has(id);
      const isSelected = selectedTerritoryId === id;
      const regionStyle =
        regionBorders[path.dataset.region ?? ""] ?? fallbackRegionBorder;
      const signature = [
        territory.ownerColor,
        isAvailable ? 1 : 0,
        isTarget ? 1 : 0,
        isSelected ? 1 : 0,
        regionStyle.stroke,
      ].join(":");

      if (visualSignatureRef.current.get(id) === signature) continue;
      visualSignatureRef.current.set(id, signature);

      path.style.fill = colorHex(territory.ownerColor);
      path.style.fillOpacity = isAvailable || isTarget || isSelected ? "0.86" : "0.55";
      path.style.stroke = regionStyle.stroke;
      path.style.strokeWidth = isSelected ? "8" : isTarget ? "7" : isAvailable ? "5" : "4";
      path.style.filter =
        isSelected || isTarget
          ? `brightness(1.12) drop-shadow(0 0 9px ${regionStyle.glow})`
          : isAvailable
            ? `brightness(1.06) drop-shadow(0 0 7px ${regionStyle.glow})`
            : "none";
      path.classList.toggle("is-selected", isSelected);
    }
  }, [territories, selectedTerritoryId, availableTerritoryIds, targetTerritoryIds]);

  const hoveredDetails =
    hoveredTerritoryId === null
      ? undefined
      : detailsByIdRef.current.get(hoveredTerritoryId);
  const hoveredState =
    hoveredTerritoryId === null ? undefined : territoryById.get(hoveredTerritoryId);
  const relevantConnection =
    hoveredTerritoryId !== null &&
    selectedTerritoryId &&
    selectedTerritoryId !== hoveredTerritoryId
      ? connections.find(
          (connection) =>
            (connection.territoryA === selectedTerritoryId &&
              connection.territoryB === hoveredTerritoryId) ||
            (connection.territoryB === selectedTerritoryId &&
              connection.territoryA === hoveredTerritoryId),
        )
      : undefined;
  const from = arrow ? anchors.get(arrow.fromTerritoryId) : undefined;
  const to = arrow ? anchors.get(arrow.toTerritoryId) : undefined;
  const jurassicTunnel = connections.find(
    (connection) => connection.barrierName === "Túnel Jurássico",
  );
  const jurassicDestinationId = jurassicTunnel
    ? jurassicTunnel.territoryA === 3
      ? jurassicTunnel.territoryB
      : jurassicTunnel.territoryA
    : null;
  const tunnelFrom = jurassicDestinationId ? anchors.get(3) : undefined;
  const tunnelTo = jurassicDestinationId
    ? anchors.get(jurassicDestinationId)
    : undefined;
  const tunnelTargetName = jurassicDestinationId
    ? TERRITORY_METADATA[jurassicDestinationId]?.name
    : null;

  function toggleRoads() {
    setRoadsVisible((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(ROAD_VISIBILITY_KEY, String(next));
      } catch {
        // A preferência visual continua funcionando na sessão mesmo sem storage.
      }
      return next;
    });
  }

  return (
    <div className="game-map-canvas" aria-label="Tabuleiro do Brasil">
      <button
        type="button"
        className="game-road-toggle"
        aria-pressed={roadsVisible}
        onClick={toggleRoads}
        title={roadsVisible ? "Ocultar estradas" : "Mostrar estradas"}
      >
        <span aria-hidden="true">🛣️</span>
        <span>Estradas</span>
        <strong>{roadsVisible ? "ON" : "OFF"}</strong>
      </button>
      <div ref={containerRef} className="game-map-surface">
        <object
          ref={boardRef}
          data="/war-brasil-42.production.svg"
          type="image/svg+xml"
          title="Mapa interativo do Brasil"
          aria-label="Mapa interativo do Brasil"
          onLoad={initializeBoard}
          className="game-map-object"
        >
          <p>Não foi possível carregar o mapa interativo.</p>
        </object>
        {roadsVisible ? (
          <RoadNetwork
            connections={connections}
            anchors={anchors}
            visible
            selectedTerritoryId={selectedTerritoryId}
            targetTerritoryIds={targetTerritoryIds}
          />
        ) : null}
        {tunnelFrom && tunnelTo && tunnelTargetName ? (
          <JurassicTunnelConnection
            from={tunnelFrom}
            to={tunnelTo}
            targetName={tunnelTargetName}
          />
        ) : null}
        {from && to && arrow ? (
          <TerritoryArrow from={from} to={to} kind={arrow.kind} />
        ) : null}
        {hoveredDetails && hoveredState ? (
          <div ref={tooltipRef} className="game-territory-tooltip" style={{ left: 0, top: 0 }}>
            <p className="font-semibold">{hoveredDetails.name}</p>
            <p className="mt-1 text-[#c8d9d1]">
              {hoveredState.ownerName} ·{" "}
              {regionLabels[hoveredDetails.region] ?? hoveredDetails.region}
            </p>
            <p className="mt-1 font-semibold text-[#e8c35e]">
              {hoveredState.troops} tropas
            </p>
            {relevantConnection ? (
              <p className="mt-2 border-t border-white/15 pt-2 text-[#ffd6a1]">
                {relevantConnection.barrierName === "Túnel Jurássico"
                  ? "🦖 Túnel Jurássico"
                  : relevantConnection.passable
                    ? "Fronteira militar disponível"
                    : relevantConnection.barrierName ?? "Fronteira bloqueada"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

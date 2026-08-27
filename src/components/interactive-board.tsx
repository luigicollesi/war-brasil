"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JurassicTunnelConnection } from "@/src/components/jurassic-tunnel-connection";
import { RoadNetwork } from "@/src/components/road-network";
import {
  useRoadVisibility,
  useTroopVisibility,
} from "@/src/components/road-visibility-provider";
import {
  TerritoryArrow,
  type TerritoryArrowKind,
} from "@/src/components/territory-arrow";
import { TerritorySpecialMarkers } from "@/src/components/territory-special-markers";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import type { MapTargetHint } from "@/src/lib/game-interaction";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";
import {
  findTerritoryConnection,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";
import type { TerritoryGeometry } from "@/src/lib/territory-geometry";
import { territoryGeometryFromPath } from "@/src/lib/territory-svg-geometry";

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

type HoveredTerritory = {
  id: number;
  details: TerritoryDetails;
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
  targetHints?: readonly MapTargetHint[];
  arrow?: MapArrow;
};

const EMPTY_TARGET_HINTS: readonly MapTargetHint[] = [];

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

function troopMarkerRadius(troops: number) {
  const digits = String(Math.max(0, troops)).length;
  if (digits <= 1) return 19;
  if (digits === 2) return 22;
  return 26;
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
  const target = event.target as {
    closest?: (selector: string) => Element | null;
  } | null;
  const path = target?.closest?.("path.territory") as SVGPathElement | null;
  return path && root.contains(path) ? path : null;
}

export function InteractiveBoard({
  territories,
  connections = [],
  onSelect,
  selectedTerritoryId,
  availableTerritoryIds = [],
  targetHints = EMPTY_TARGET_HINTS,
  arrow = null,
}: InteractiveBoardProps) {
  const boardRef = useRef<HTMLObjectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pathsByIdRef = useRef(new Map<number, SVGPathElement>());
  const visualSignatureRef = useRef(new Map<number, string>());
  const cleanupBoardRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const tooltipFrameRef = useRef(0);
  const hoveredTerritoryRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const [geometries, setGeometries] = useState<Map<number, TerritoryGeometry>>(
    new Map(),
  );
  const [hoveredTerritory, setHoveredTerritory] =
    useState<HoveredTerritory | null>(null);
  const roadsVisible = useRoadVisibility();
  const troopsVisible = useTroopVisibility();
  const territoryById = useMemo(
    () => new Map(territories.map((territory) => [territory.territoryId, territory])),
    [territories],
  );
  const targetById = useMemo(
    () =>
      new Map(
        targetHints.map((target) => [target.territoryId, target]),
      ),
    [targetHints],
  );
  const roadTargetTerritoryIds = useMemo(
    () => targetHints.map((target) => target.territoryId),
    [targetHints],
  );
  const specialMarkerIds = useMemo(
    () =>
      new Set(
        targetHints
          .filter((target) => target.kind !== "normal")
          .map((target) => target.territoryId),
      ),
    [targetHints],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
    const nextGeometries = new Map<number, TerritoryGeometry>();

    for (const path of paths) {
      const id = Number(path.dataset.id);
      nextPaths.set(id, path);
      nextGeometries.set(id, territoryGeometryFromPath(path));
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", path.dataset.name ?? "Território");
      path.style.cursor = "pointer";
    }

    pathsByIdRef.current = nextPaths;
    visualSignatureRef.current.clear();
    setGeometries(nextGeometries);

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
      const id = Number(path.dataset.id);
      hoveredTerritoryRef.current = id;
      setHoveredTerritory((current) =>
        current?.id === id ? current : { id, details: readTerritory(path) },
      );
      scheduleTooltipPosition(event as PointerEvent);
    };
    const pointerMove = (event: Event) => {
      if (
        hoveredTerritoryRef.current === null &&
        !territoryPathFromEvent(event, root)
      ) {
        return;
      }
      scheduleTooltipPosition(event as PointerEvent);
    };
    const pointerOut = (event: Event) => {
      const path = territoryPathFromEvent(event, root);
      if (!path) return;
      const related = (event as PointerEvent).relatedTarget as Node | null;
      if (related && path.contains(related)) return;
      hoveredTerritoryRef.current = null;
      setHoveredTerritory(null);
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

    for (const territory of territories) {
      const path = pathsByIdRef.current.get(territory.territoryId);
      if (!path) continue;

      const id = territory.territoryId;
      const isAvailable = available.has(id);
      const targetHint = targetById.get(id);
      const isTarget = Boolean(targetHint);
      const targetSelectable = targetHint?.selectable ?? false;
      const isSelected = selectedTerritoryId === id;
      const regionStyle =
        regionBorders[path.dataset.region ?? ""] ?? fallbackRegionBorder;
      const signature = [
        territory.ownerColor,
        isAvailable ? 1 : 0,
        isTarget ? 1 : 0,
        targetSelectable ? 1 : 0,
        isSelected ? 1 : 0,
        regionStyle.stroke,
      ].join(":");

      if (visualSignatureRef.current.get(id) === signature) continue;
      visualSignatureRef.current.set(id, signature);

      path.style.fill = colorHex(territory.ownerColor);
      path.style.fillOpacity = isSelected || isAvailable || targetSelectable
        ? "0.86"
        : isTarget
          ? "0.72"
          : "0.55";
      path.style.stroke = regionStyle.stroke;
      path.style.strokeWidth = isSelected
        ? "8"
        : targetSelectable
          ? "7"
          : isTarget
            ? "6"
            : isAvailable
              ? "5"
              : "4";
      path.style.filter =
        isSelected || targetSelectable
          ? `brightness(1.12) drop-shadow(0 0 9px ${regionStyle.glow})`
          : isTarget || isAvailable
            ? `brightness(1.06) drop-shadow(0 0 7px ${regionStyle.glow})`
            : "none";
      path.classList.toggle("is-selected", isSelected);
    }
  }, [
    geometries,
    territories,
    selectedTerritoryId,
    availableTerritoryIds,
    targetById,
  ]);

  const hoveredTerritoryId = hoveredTerritory?.id ?? null;
  const hoveredDetails = hoveredTerritory?.details;
  const hoveredState =
    hoveredTerritoryId === null
      ? undefined
      : territoryById.get(hoveredTerritoryId);
  const hoveredTargetHint =
    hoveredTerritoryId === null ? undefined : targetById.get(hoveredTerritoryId);
  const relevantConnection =
    hoveredTerritoryId !== null &&
    selectedTerritoryId !== null &&
    selectedTerritoryId !== undefined &&
    selectedTerritoryId !== hoveredTerritoryId
      ? findTerritoryConnection(
          connections,
          selectedTerritoryId,
          hoveredTerritoryId,
        )
      : undefined;
  const from = arrow ? geometries.get(arrow.fromTerritoryId) : undefined;
  const to = arrow ? geometries.get(arrow.toTerritoryId) : undefined;
  const jurassicTunnel = connections.find(
    (connection) => connection.barrierName === "Túnel Jurássico",
  );
  const jurassicDestinationId = jurassicTunnel
    ? jurassicTunnel.territoryA === 3
      ? jurassicTunnel.territoryB
      : jurassicTunnel.territoryA
    : null;
  const tunnelFrom = jurassicDestinationId ? geometries.get(3) : undefined;
  const tunnelTo = jurassicDestinationId
    ? geometries.get(jurassicDestinationId)
    : undefined;
  const tunnelTargetName = jurassicDestinationId
    ? TERRITORY_METADATA[jurassicDestinationId]?.name
    : null;

  return (
    <div className="game-map-canvas" aria-label="Tabuleiro do Brasil">
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
            anchors={geometries}
            visible
            selectedTerritoryId={selectedTerritoryId}
            targetTerritoryIds={roadTargetTerritoryIds}
          />
        ) : null}
        {troopsVisible ? (
          <svg
            aria-hidden="true"
            className="game-troop-layer pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 1254 1254"
          >
            {territories.map((territory) => {
              if (specialMarkerIds.has(territory.territoryId)) return null;

              const geometry = geometries.get(territory.territoryId);
              if (!geometry) return null;
              const radius = troopMarkerRadius(territory.troops);

              return (
                <g
                  key={territory.territoryId}
                  transform={`translate(${geometry.x} ${geometry.y})`}
                >
                  <circle
                    r={radius}
                    fill="rgba(4, 22, 17, 0.88)"
                    stroke={colorHex(territory.ownerColor)}
                    strokeWidth="5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x="0"
                    y="1"
                    fill="#fffdf5"
                    fontSize="21"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="central"
                    paintOrder="stroke"
                    stroke="rgba(0,0,0,.34)"
                    strokeWidth="2"
                  >
                    {territory.troops}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
        {tunnelFrom && tunnelTo && tunnelTargetName ? (
          <JurassicTunnelConnection
            from={tunnelFrom}
            to={tunnelTo}
            targetName={tunnelTargetName}
          />
        ) : null}
        <TerritorySpecialMarkers
          targets={targetHints}
          geometries={geometries}
        />
        {from && to && arrow ? (
          <TerritoryArrow from={from} to={to} kind={arrow.kind} />
        ) : null}
        {hoveredDetails && hoveredState ? (
          <div
            ref={tooltipRef}
            className="game-territory-tooltip"
            style={{ left: 0, top: 0 }}
          >
            <p className="font-semibold">{hoveredDetails.name}</p>
            <p className="mt-1 text-[#c8d9d1]">
              {hoveredState.ownerName} ·{" "}
              {regionLabels[hoveredDetails.region] ?? hoveredDetails.region}
            </p>
            <p className="mt-1 font-semibold text-[#e8c35e]">
              {hoveredState.troops} tropas
            </p>
            {hoveredTargetHint?.kind === "barrier-attack" ? (
              <p className="mt-2 border-t border-white/15 pt-2 text-[#ffd6a1]">
                ☠ {hoveredTargetHint.barrierName ?? "Ataque por barreira"}
                {!hoveredTargetHint.selectable ? " · tropas insuficientes" : ""}
              </p>
            ) : hoveredTargetHint?.kind === "barrier-maneuver" ? (
              <p className="mt-2 border-t border-white/15 pt-2 text-[#b9d7ff]">
                Travessia por {hoveredTargetHint.barrierName ?? "barreira"} · 1 tropa perdida
                {!hoveredTargetHint.selectable ? " · tropas insuficientes" : ""}
              </p>
            ) : relevantConnection?.exists ? (
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
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { BoardPresentationState } from "@/src/lib/client/map/board-presentation";
import { NORMAL_BOARD_PRESENTATION } from "@/src/lib/client/map/board-presentation";
import {
  MAP_GESTURE_STATE_EVENT,
  MAP_VISUALS_READY_EVENT,
  isMapGestureState,
} from "@/src/lib/client/map/map-runtime-events";
import {
  neutralTerritoryMaterial,
  territoryMaterial,
} from "@/src/lib/client/map/territory-material";
import { buildTerritoryHitLayer } from "@/src/lib/client/map/territory-hit-geometry";
import { territoryIdFromEvent } from "@/src/lib/client/map/territory-svg-interaction";
import {
  applyTerritoryMaterial,
  collectTerritoryVisualNodes,
  type TerritoryVisualNodes,
} from "@/src/lib/client/map/territory-svg-nodes";
import {
  applyTerritoryHoverState,
  applyTerritoryKeyboardFocusState,
  applyTerritoryVisualState,
  ensureTerritoryRuntimeStyles,
} from "@/src/lib/client/map/territory-visual-state";
import {
  barrierAttackSummary,
  barrierManeuverSummary,
} from "@/src/lib/game-barrier-presentation";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import type { GamePhase } from "@/src/lib/game-contract";
import type { MapTargetHint } from "@/src/lib/game-interaction";
import { deriveMapFocusTerritoryIds } from "@/src/lib/game-map-focus";
import {
  DEFAULT_MAP_VIEWPORT,
  MAP_VIEWPORT_EVENT,
  MAP_WORLD_SIZE,
  projectMapPoint,
  type MapViewportTransform,
} from "@/src/lib/game-map-viewport";
import type { PlayerColor } from "@/src/lib/lobby";
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
  targetHints: readonly MapTargetHint[];
  interactionMode: GamePhase;
  arrow?: MapArrow;
  presentation?: BoardPresentationState;
};

const regionLabels: Record<string, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

function preferredTroopMarkerRadius(troops: number) {
  const digits = String(Math.max(0, troops)).length;
  if (digits <= 1) return 19;
  if (digits === 2) return 22;
  return 26;
}

function desktopTroopMarkerRadius(
  troops: number,
  geometry: TerritoryGeometry,
  topInset: number,
) {
  const preferred = preferredTroopMarkerRadius(troops);
  const visualSafeRadius = Math.max(0, geometry.safeRadius - topInset) * 0.82;
  return Math.max(7, Math.min(preferred, visualSafeRadius));
}

function mobileTroopMarkerRadius({
  troops,
  geometry,
  topInset,
  viewport,
  surfaceWidth,
}: {
  troops: number;
  geometry: TerritoryGeometry;
  topInset: number;
  viewport: MapViewportTransform;
  surfaceWidth: number;
}) {
  const digits = String(Math.max(0, troops)).length;
  const preferred = digits <= 1 ? 12 : digits === 2 ? 13.5 : 15;
  const visualSafeWorld = Math.max(0, geometry.safeRadius - topInset);
  const safePixels =
    (visualSafeWorld / MAP_WORLD_SIZE) * surfaceWidth * viewport.scale * 0.82;
  return Math.max(5, Math.min(preferred, safePixels));
}

function MobileTroopCanvas({
  territories,
  geometries,
  specialMarkerIds,
  topInset,
}: {
  territories: readonly BoardTerritory[];
  geometries: ReadonlyMap<number, TerritoryGeometry>;
  specialMarkerIds: ReadonlySet<number>;
  topInset: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<MapViewportTransform>({ ...DEFAULT_MAP_VIEWPORT });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawingCanvas: HTMLCanvasElement = canvas;
    const surface = drawingCanvas.parentElement;

    function draw() {
      const width = drawingCanvas.clientWidth;
      const height = drawingCanvas.clientHeight;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      if (
        drawingCanvas.width !== pixelWidth ||
        drawingCanvas.height !== pixelHeight
      ) {
        drawingCanvas.width = pixelWidth;
        drawingCanvas.height = pixelHeight;
      }

      const context = drawingCanvas.getContext("2d");
      if (!context) return;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      for (const territory of territories) {
        if (specialMarkerIds.has(territory.territoryId)) continue;
        const geometry = geometries.get(territory.territoryId);
        if (!geometry) continue;

        const digits = String(Math.max(0, territory.troops)).length;
        const radius = mobileTroopMarkerRadius({
          troops: territory.troops,
          geometry,
          topInset,
          viewport: viewportRef.current,
          surfaceWidth: width,
        });
        const fontSize = Math.max(
          9,
          Math.min(digits <= 1 ? 18 : digits === 2 ? 16 : 13, radius * 1.32),
        );
        const point = projectMapPoint(
          { x: geometry.x, y: geometry.y },
          width,
          height,
          viewportRef.current,
        );
        const markerMaterial = territoryMaterial(territory.ownerColor);

        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fillStyle = "#f3efe4";
        context.fill();
        context.lineWidth = Math.max(1.25, Math.min(2, radius * 0.15));
        context.strokeStyle = markerMaterial.side[0];
        context.stroke();

        context.fillStyle = "#17201c";
        context.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(territory.troops), point.x, point.y + 0.5);
      }
    }

    const onViewportChange = (event: Event) => {
      const viewportEvent = event as CustomEvent<MapViewportTransform>;
      if (!viewportEvent.detail) return;
      viewportRef.current = viewportEvent.detail;
      draw();
    };

    const observer = new ResizeObserver(draw);
    observer.observe(drawingCanvas);
    surface?.addEventListener(MAP_VIEWPORT_EVENT, onViewportChange);
    draw();

    return () => {
      observer.disconnect();
      surface?.removeEventListener(MAP_VIEWPORT_EVENT, onViewportChange);
    };
  }, [geometries, specialMarkerIds, territories, topInset]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full max-[767px]:block"
    />
  );
}

function readTerritory(path: SVGPathElement): TerritoryDetails {
  return {
    id: Number(path.dataset.id),
    name: path.dataset.name ?? "Território",
    region: path.dataset.region ?? "",
    state: path.dataset.uf ?? "—",
  };
}

export function InteractiveBoard({
  territories,
  connections = [],
  onSelect,
  selectedTerritoryId,
  availableTerritoryIds = [],
  targetHints,
  interactionMode,
  arrow = null,
  presentation = NORMAL_BOARD_PRESENTATION,
}: InteractiveBoardProps) {
  const boardRef = useRef<HTMLObjectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const visualNodesByIdRef = useRef(new Map<number, TerritoryVisualNodes>());
  const materialSignatureRef = useRef(new Map<number, string>());
  const visualSignatureRef = useRef(new Map<number, string>());
  const cleanupBoardRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const tooltipFrameRef = useRef(0);
  const hoveredTerritoryRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const interactionEnabledRef = useRef(true);
  const gestureActiveRef = useRef(false);
  const [geometries, setGeometries] = useState<Map<number, TerritoryGeometry>>(
    new Map(),
  );
  const [mapTopInset, setMapTopInset] = useState(4);
  const [hoveredTerritory, setHoveredTerritory] =
    useState<HoveredTerritory | null>(null);
  const roadsVisible = useRoadVisibility();
  const troopsVisible = useTroopVisibility();
  const effectivePresentation = presentation;
  const presentationActive = effectivePresentation.mode !== "normal";
  interactionEnabledRef.current = !presentationActive;

  const territoryById = useMemo(
    () => new Map(territories.map((territory) => [territory.territoryId, territory])),
    [territories],
  );
  const targetById = useMemo(
    () => new Map(targetHints.map((target) => [target.territoryId, target])),
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
  const focusTerritoryIds = useMemo(
    () =>
      presentationActive
        ? []
        : deriveMapFocusTerritoryIds({
            phase: interactionMode,
            selectedTerritoryId,
            targetHints,
            arrow,
          }),
    [arrow, interactionMode, presentationActive, selectedTerritoryId, targetHints],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const clearHoveredTerritory = useCallback(() => {
    const previousId = hoveredTerritoryRef.current;
    if (previousId !== null) {
      const previousNodes = visualNodesByIdRef.current.get(previousId);
      if (previousNodes) applyTerritoryHoverState(previousNodes, false);
    }
    hoveredTerritoryRef.current = null;
    setHoveredTerritory(null);
  }, []);

  useEffect(() => {
    if (presentationActive) clearHoveredTerritory();
  }, [clearHoveredTerritory, presentationActive]);

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
    const faceRoot = mapDocument?.querySelector("#territories");
    const root = mapDocument?.querySelector("#board-v2");
    const surface = containerRef.current;
    if (!mapDocument || !faceRoot || !root || !surface) return;

    root.setAttribute("data-map-interaction-root", "true");

    const paths = Array.from(
      faceRoot.querySelectorAll<SVGPathElement>("path.territory"),
    );
    if (!paths.length) return;

    ensureTerritoryRuntimeStyles(mapDocument);

    const nextGeometries = new Map<number, TerritoryGeometry>();
    for (const path of paths) {
      const id = Number(path.dataset.id);
      nextGeometries.set(id, territoryGeometryFromPath(path));
      path.removeAttribute("tabindex");
      path.removeAttribute("role");
      path.removeAttribute("aria-label");
    }

    const nextVisualNodes = collectTerritoryVisualNodes(mapDocument, paths);
    buildTerritoryHitLayer(mapDocument, root, nextVisualNodes);

    visualNodesByIdRef.current = nextVisualNodes;
    materialSignatureRef.current.clear();
    visualSignatureRef.current.clear();
    hoveredTerritoryRef.current = null;
    setHoveredTerritory(null);
    setGeometries(nextGeometries);

    const topInset = Number(mapDocument.documentElement.getAttribute("data-top-inset"));
    setMapTopInset(Number.isFinite(topInset) ? Math.max(0, topInset) : 4);

    const setHoveredTerritoryId = (nextId: number | null) => {
      const previousId = hoveredTerritoryRef.current;
      if (previousId === nextId) return;

      if (previousId !== null) {
        const previousNodes = visualNodesByIdRef.current.get(previousId);
        if (previousNodes) applyTerritoryHoverState(previousNodes, false);
      }

      if (nextId === null) {
        hoveredTerritoryRef.current = null;
        setHoveredTerritory(null);
        return;
      }

      const nextNodes = visualNodesByIdRef.current.get(nextId);
      if (!nextNodes) {
        hoveredTerritoryRef.current = null;
        setHoveredTerritory(null);
        return;
      }

      hoveredTerritoryRef.current = nextId;
      applyTerritoryHoverState(nextNodes, true);
      setHoveredTerritory({
        id: nextId,
        details: readTerritory(nextNodes.face),
      });
    };

    const click = (event: Event) => {
      if (!interactionEnabledRef.current || gestureActiveRef.current) return;
      const id = territoryIdFromEvent(event, root);
      if (id !== null) onSelectRef.current?.(id);
    };

    const keyDown = (event: Event) => {
      if (!interactionEnabledRef.current || gestureActiveRef.current) return;
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      const id = territoryIdFromEvent(event, root);
      if (id === null) return;
      keyboardEvent.preventDefault();
      onSelectRef.current?.(id);
    };

    const syncPointerHover = (event: Event) => {
      if (!interactionEnabledRef.current || gestureActiveRef.current) {
        setHoveredTerritoryId(null);
        return;
      }
      const id = territoryIdFromEvent(event, root);
      setHoveredTerritoryId(id);
      if (id !== null) scheduleTooltipPosition(event as PointerEvent);
    };

    const pointerLeave = () => setHoveredTerritoryId(null);

    const focusIn = (event: Event) => {
      const id = territoryIdFromEvent(event, root);
      if (id === null) return;
      const nodes = visualNodesByIdRef.current.get(id);
      if (nodes) applyTerritoryKeyboardFocusState(nodes, true);
    };

    const focusOut = (event: Event) => {
      const id = territoryIdFromEvent(event, root);
      if (id === null) return;
      const nodes = visualNodesByIdRef.current.get(id);
      if (nodes) applyTerritoryKeyboardFocusState(nodes, false);
    };

    const gestureState = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isMapGestureState(detail)) return;
      gestureActiveRef.current = detail.active;
      if (detail.active) setHoveredTerritoryId(null);
    };

    root.addEventListener("click", click);
    root.addEventListener("keydown", keyDown);
    root.addEventListener("pointerover", syncPointerHover);
    root.addEventListener("pointermove", syncPointerHover);
    root.addEventListener("pointerleave", pointerLeave);
    root.addEventListener("focusin", focusIn);
    root.addEventListener("focusout", focusOut);
    surface.addEventListener(MAP_GESTURE_STATE_EVENT, gestureState);

    surface.dispatchEvent(new CustomEvent(MAP_VISUALS_READY_EVENT));

    cleanupBoardRef.current = () => {
      root.removeEventListener("click", click);
      root.removeEventListener("keydown", keyDown);
      root.removeEventListener("pointerover", syncPointerHover);
      root.removeEventListener("pointermove", syncPointerHover);
      root.removeEventListener("pointerleave", pointerLeave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      surface.removeEventListener(MAP_GESTURE_STATE_EVENT, gestureState);
      clearHoveredTerritory();
      gestureActiveRef.current = false;
    };
  }

  useEffect(() => {
    const available = new Set(availableTerritoryIds);
    const opening =
      effectivePresentation.mode === "initial-territory-draw"
        ? effectivePresentation
        : null;

    for (const territory of territories) {
      const id = territory.territoryId;
      const nodes = visualNodesByIdRef.current.get(id);
      if (!nodes) continue;

      const revealed = !opening || opening.revealedTerritoryIds.has(id);
      const materialKey = revealed ? `owner:${territory.ownerColor}` : "neutral";

      if (materialSignatureRef.current.get(id) !== materialKey) {
        applyTerritoryMaterial(
          id,
          nodes,
          revealed
            ? territoryMaterial(territory.ownerColor)
            : neutralTerritoryMaterial(),
        );
        materialSignatureRef.current.set(id, materialKey);
      }

      const gameplayVisuals = !opening;
      const isAvailable = gameplayVisuals && available.has(id);
      const targetHint = gameplayVisuals ? targetById.get(id) : undefined;
      const isTarget = Boolean(targetHint);
      const targetSelectable = targetHint?.selectable ?? false;
      const isSelected = gameplayVisuals && selectedTerritoryId === id;
      const openingHighlight = Boolean(
        opening &&
          revealed &&
          opening.highlightOn &&
          opening.highlightPlayerId &&
          territory.ownerPlayerId === opening.highlightPlayerId,
      );
      const signature = [
        isAvailable ? 1 : 0,
        isTarget ? 1 : 0,
        targetSelectable ? 1 : 0,
        isSelected ? 1 : 0,
        openingHighlight ? 1 : 0,
      ].join(":");

      if (visualSignatureRef.current.get(id) === signature) continue;
      visualSignatureRef.current.set(id, signature);

      applyTerritoryVisualState(nodes, {
        available: isAvailable,
        target: isTarget,
        targetSelectable,
        selected: isSelected,
        openingHighlight,
      });
    }
  }, [
    geometries,
    territories,
    selectedTerritoryId,
    availableTerritoryIds,
    targetById,
    effectivePresentation,
  ]);

  const hoveredTerritoryId = hoveredTerritory?.id ?? null;
  const hoveredDetails = hoveredTerritory?.details;
  const hoveredState =
    hoveredTerritoryId === null
      ? undefined
      : territoryById.get(hoveredTerritoryId);
  const hoveredTargetHint =
    hoveredTerritoryId === null ? undefined : targetById.get(hoveredTerritoryId);
  const hoveredBarrierSummary =
    hoveredTargetHint?.kind === "barrier-attack"
      ? barrierAttackSummary({
          barrierName: hoveredTargetHint.barrierName,
          selectable: hoveredTargetHint.selectable,
          minimumTroops: hoveredTargetHint.minimumTroops,
        })
      : hoveredTargetHint?.kind === "barrier-maneuver"
        ? barrierManeuverSummary({
            barrierName: hoveredTargetHint.barrierName,
            selectable: hoveredTargetHint.selectable,
            minimumTroops: hoveredTargetHint.minimumTroops,
            troopLoss: hoveredTargetHint.troopLoss,
          })
        : null;
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
      <div
        ref={containerRef}
        className="game-map-surface"
        data-map-focus-ids={focusTerritoryIds.join(",")}
        data-map-presentation-active={presentationActive ? "true" : "false"}
      >
        <object
          ref={boardRef}
          data="/mapa-war-brasil-25d.svg"
          type="image/svg+xml"
          title="Mapa interativo do Brasil"
          aria-label="Mapa interativo do Brasil"
          onLoad={initializeBoard}
          className="game-map-object"
        >
          <p>Não foi possível carregar o mapa interativo.</p>
        </object>

        {effectivePresentation.mode === "initial-territory-draw" &&
        effectivePresentation.titleVisible ? (
          <div
            data-initial-territory-title
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          >
            <div
              className="rounded-2xl border border-transparent bg-transparent px-6 py-4 text-center text-2xl font-semibold tracking-[-0.035em] text-[#17372d] sm:text-3xl"
              style={{ textShadow: "0 2px 12px rgba(250, 248, 242, 0.95)" }}
              role="status"
            >
              Sorteio de Territórios
            </div>
          </div>
        ) : null}

        {!presentationActive && roadsVisible ? (
          <RoadNetwork
            connections={connections}
            anchors={geometries}
            visible
            selectedTerritoryId={selectedTerritoryId}
            targetTerritoryIds={roadTargetTerritoryIds}
          />
        ) : null}

        {!presentationActive && troopsVisible ? (
          <>
            <svg
              aria-hidden="true"
              className="game-troop-layer pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block"
              viewBox="0 0 1254 1254"
            >
              {territories.map((territory) => {
                if (specialMarkerIds.has(territory.territoryId)) return null;

                const geometry = geometries.get(territory.territoryId);
                if (!geometry) return null;
                const radius = desktopTroopMarkerRadius(
                  territory.troops,
                  geometry,
                  mapTopInset,
                );
                const markerMaterial = territoryMaterial(territory.ownerColor);

                return (
                  <g
                    key={territory.territoryId}
                    transform={`translate(${geometry.x} ${geometry.y})`}
                  >
                    <circle
                      r={radius}
                      fill="#f3efe4"
                      stroke={markerMaterial.side[0]}
                      strokeWidth="4"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x="0"
                      y="1"
                      fill="#17201c"
                      fontSize={Math.max(11, Math.min(21, radius * 1.05))}
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="central"
                      paintOrder="stroke"
                      stroke="rgba(255,255,255,.34)"
                      strokeWidth="1.5"
                    >
                      {territory.troops}
                    </text>
                  </g>
                );
              })}
            </svg>
            <MobileTroopCanvas
              territories={territories}
              geometries={geometries}
              specialMarkerIds={specialMarkerIds}
              topInset={mapTopInset}
            />
          </>
        ) : null}

        {!presentationActive && tunnelFrom && tunnelTo && tunnelTargetName ? (
          <JurassicTunnelConnection
            from={tunnelFrom}
            to={tunnelTo}
            targetName={tunnelTargetName}
          />
        ) : null}

        {!presentationActive ? (
          <TerritorySpecialMarkers targets={targetHints} geometries={geometries} />
        ) : null}

        {!presentationActive && from && to && arrow ? (
          <TerritoryArrow from={from} to={to} kind={arrow.kind} />
        ) : null}

        {!presentationActive && hoveredDetails && hoveredState ? (
          <div
            ref={tooltipRef}
            className="game-territory-tooltip"
            style={{ left: 0, top: 0 }}
          >
            <p className="flex items-center gap-2 font-semibold">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                style={{
                  backgroundColor: territoryMaterial(hoveredState.ownerColor).face[2],
                }}
              />
              {hoveredDetails.name}
            </p>
            <p className="mt-1 text-[#c8d9d1]">
              {hoveredState.ownerName} ·{" "}
              {regionLabels[hoveredDetails.region] ?? hoveredDetails.region}
            </p>
            <p className="mt-1 font-semibold text-[#e8c35e]">
              {hoveredState.troops} tropas
            </p>
            {hoveredBarrierSummary ? (
              <div
                className="game-tooltip-barrier mt-2 border-t border-white/15 pt-2"
                data-blocked={hoveredBarrierSummary.blocked}
              >
                <p className="font-semibold">▣ {hoveredBarrierSummary.name}</p>
                <p className="mt-1 text-xs">{hoveredBarrierSummary.detail}</p>
              </div>
            ) : relevantConnection?.exists ? (
              <p className="mt-2 border-t border-white/15 pt-2 text-[#ffd6a1]">
                {relevantConnection.barrierName === "Túnel Jurássico"
                  ? "Túnel Jurássico"
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

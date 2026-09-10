"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  barrierAttackSummary,
  barrierManeuverSummary,
} from "@/src/lib/game-barrier-presentation";
import type { MapTargetHint } from "@/src/lib/game-interaction";
import { territoryMaterial } from "@/src/lib/client/map/territory-material";
import type { PlayerColor } from "@/src/lib/lobby";
import {
  findTerritoryConnection,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";

const TOOLTIP_OFFSET = 8;
const TOOLTIP_EDGE_GAP = 6;
const DEFAULT_TOOLTIP_WIDTH = 208;
const DEFAULT_TOOLTIP_HEIGHT = 112;

const regionLabels: Record<string, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

export type TerritoryTooltipDetails = {
  id: number;
  name: string;
  region: string;
  state: string;
};

export type TerritoryTooltipHandle = {
  show(details: TerritoryTooltipDetails): void;
  hide(): void;
  move(position: {
    x: number;
    y: number;
    surfaceWidth: number;
    surfaceHeight: number;
  }): void;
};

type TerritoryTooltipTerritory = {
  territoryId: number;
  ownerName: string;
  ownerColor: PlayerColor;
  troops: number;
};

type TerritoryTooltipProps = {
  territories: readonly TerritoryTooltipTerritory[];
  targetHints: readonly MapTargetHint[];
  connections: readonly TerritoryConnection[];
  selectedTerritoryId?: number | null;
};

type TooltipPosition = {
  x: number;
  y: number;
  surfaceWidth: number;
  surfaceHeight: number;
};

export const TerritoryTooltip = forwardRef<
  TerritoryTooltipHandle,
  TerritoryTooltipProps
>(function TerritoryTooltip(
  { territories, targetHints, connections, selectedTerritoryId },
  ref,
) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const positionRef = useRef<TooltipPosition | null>(null);
  const sizeRef = useRef({
    width: DEFAULT_TOOLTIP_WIDTH,
    height: DEFAULT_TOOLTIP_HEIGHT,
  });
  const [hoveredDetails, setHoveredDetails] =
    useState<TerritoryTooltipDetails | null>(null);

  const territoryById = useMemo(
    () => new Map(territories.map((territory) => [territory.territoryId, territory])),
    [territories],
  );
  const targetById = useMemo(
    () => new Map(targetHints.map((target) => [target.territoryId, target])),
    [targetHints],
  );

  const applyPosition = useCallback(() => {
    const tooltip = tooltipRef.current;
    const position = positionRef.current;
    if (!tooltip || !position) return;

    const { width, height } = sizeRef.current;
    const { x, y, surfaceWidth, surfaceHeight } = position;

    let nextX = x + TOOLTIP_OFFSET;
    let nextY = y + TOOLTIP_OFFSET;

    if (nextX + width + TOOLTIP_EDGE_GAP > surfaceWidth) {
      nextX = x - width - TOOLTIP_OFFSET;
    }
    if (nextY + height + TOOLTIP_EDGE_GAP > surfaceHeight) {
      nextY = y - height - TOOLTIP_OFFSET;
    }

    nextX = Math.max(
      TOOLTIP_EDGE_GAP,
      Math.min(
        nextX,
        Math.max(
          TOOLTIP_EDGE_GAP,
          surfaceWidth - width - TOOLTIP_EDGE_GAP,
        ),
      ),
    );
    nextY = Math.max(
      TOOLTIP_EDGE_GAP,
      Math.min(
        nextY,
        Math.max(
          TOOLTIP_EDGE_GAP,
          surfaceHeight - height - TOOLTIP_EDGE_GAP,
        ),
      ),
    );

    tooltip.style.transform = `translate3d(${Math.round(nextX)}px, ${Math.round(nextY)}px, 0)`;
  }, []);

  const schedulePosition = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      applyPosition();
    });
  }, [applyPosition]);

  useImperativeHandle(
    ref,
    () => ({
      show(details) {
        setHoveredDetails((current) =>
          current?.id === details.id ? current : details,
        );
      },
      hide() {
        setHoveredDetails(null);
      },
      move(position) {
        positionRef.current = position;
        schedulePosition();
      },
    }),
    [schedulePosition],
  );

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const borderBox = entry?.borderBoxSize?.[0];
      const rect = entry?.contentRect;
      if (borderBox || rect) {
        sizeRef.current = {
          width:
            borderBox?.inlineSize || rect?.width || DEFAULT_TOOLTIP_WIDTH,
          height:
            borderBox?.blockSize || rect?.height || DEFAULT_TOOLTIP_HEIGHT,
        };
      }
      schedulePosition();
    });
    observer.observe(tooltip);
    schedulePosition();

    return () => observer.disconnect();
  }, [hoveredDetails, schedulePosition]);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  if (!hoveredDetails) return null;

  const hoveredState = territoryById.get(hoveredDetails.id);
  if (!hoveredState) return null;

  const hoveredTargetHint = targetById.get(hoveredDetails.id);
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
    selectedTerritoryId !== null &&
    selectedTerritoryId !== undefined &&
    selectedTerritoryId !== hoveredDetails.id
      ? findTerritoryConnection(
          connections,
          selectedTerritoryId,
          hoveredDetails.id,
        )
      : undefined;

  return (
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
  );
});

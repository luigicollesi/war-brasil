"use client";

import { useId } from "react";

export type TerritoryAnchor = { x: number; y: number };
export type TerritoryArrowKind = "attack" | "movement";

export const territoryArrowOffsets: Partial<Record<number, TerritoryAnchor>> = {};

export function getTerritoryAnchor(pathElement: SVGPathElement): TerritoryAnchor {
  const bbox = pathElement.getBBox();
  const territoryId = Number(pathElement.dataset.id);
  const offset = territoryArrowOffsets[territoryId];
  return {
    x: bbox.x + bbox.width / 2 + (offset?.x ?? 0),
    y: bbox.y + bbox.height / 2 + (offset?.y ?? 0),
  };
}

export function TerritoryArrow({
  from,
  to,
  kind,
}: {
  from: TerritoryAnchor;
  to: TerritoryAnchor;
  kind: TerritoryArrowKind;
}) {
  const markerId = useId().replace(/:/g, "");
  const color = kind === "attack" ? "#d64b45" : "#3976c5";
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bend = Math.min(72, Math.max(28, Math.hypot(dx, dy) * 0.18));
  const controlX = (from.x + to.x) / 2 - dy / Math.max(1, Math.hypot(dx, dy)) * bend;
  const controlY = (from.y + to.y) / 2 + dx / Math.max(1, Math.hypot(dx, dy)) * bend;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1254 1254">
      <defs>
        <marker id={markerId} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />
        </marker>
      </defs>
      <path d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`} fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="11" strokeLinecap="round" />
      <path d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" markerEnd={`url(#${markerId})`} className="territory-arrow-animation" />
    </svg>
  );
}

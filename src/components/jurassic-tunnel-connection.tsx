"use client";

import { useState } from "react";
import type { TerritoryAnchor } from "@/src/components/territory-arrow";

const MAX_CURVE = 70;

export function JurassicTunnelConnection({
  from,
  to,
  targetName,
}: {
  from: TerritoryAnchor;
  to: TerritoryAnchor;
  targetName: string;
}) {
  const [hovered, setHovered] = useState(false);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curveAmount = Math.min(distance * 0.15, MAX_CURVE);
  const controlX = (from.x + to.x) / 2 + normalX * curveAmount;
  const controlY = (from.y + to.y) / 2 + normalY * curveAmount;
  const path = `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1254 1254" aria-hidden="true">
      <path d={path} fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="10" strokeLinecap="round" />
      <path
        d={path}
        fill="none"
        stroke="#b7a33c"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="16 10"
        className="jurassic-tunnel-animation"
      />
      <path
        className="pointer-events-auto"
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="24"
        pointerEvents="stroke"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      />
      {hovered ? (
        <g pointerEvents="none" transform={`translate(${controlX + 14} ${controlY - 18})`}>
          <rect x="0" y="0" width="230" height="58" rx="10" fill="rgba(18,57,47,.96)" />
          <text x="12" y="22" fill="#f4df79" fontSize="14" fontWeight="700">🦖 Túnel Jurássico</text>
          <text x="12" y="43" fill="#ffffff" fontSize="12">Acre ↔ {targetName}</text>
        </g>
      ) : null}
    </svg>
  );
}

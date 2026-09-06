"use client";

import type { TerritoryAnchor } from "@/src/lib/territory-geometry";

const MAX_CURVE = 70;

export function JurassicTunnelConnection({
  from,
  to,
}: {
  from: TerritoryAnchor;
  to: TerritoryAnchor;
  targetName: string;
}) {
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
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 1254 1254"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,.72)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#b7a33c"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="16 10"
        className="jurassic-tunnel-animation"
      />
    </svg>
  );
}

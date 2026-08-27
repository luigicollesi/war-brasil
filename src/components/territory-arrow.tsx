"use client";

import { useId } from "react";

export type TerritoryAnchor = { x: number; y: number };
export type TerritoryArrowKind = "attack" | "movement";

type BoundaryPoint = TerritoryAnchor;

function distanceSquared(a: TerritoryAnchor, b: BoundaryPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function sampleBoundary(pathElement: SVGPathElement) {
  const totalLength = pathElement.getTotalLength();
  if (!Number.isFinite(totalLength) || totalLength <= 0) return [];

  const sampleCount = 72;
  return Array.from({ length: sampleCount }, (_, index) => {
    const point = pathElement.getPointAtLength(
      (totalLength * index) / sampleCount,
    );
    return { x: point.x, y: point.y };
  });
}

function clearanceFromBoundary(
  point: TerritoryAnchor,
  boundary: readonly BoundaryPoint[],
) {
  let nearest = Number.POSITIVE_INFINITY;

  for (const boundaryPoint of boundary) {
    nearest = Math.min(nearest, distanceSquared(point, boundaryPoint));
  }

  return nearest;
}

function isInside(pathElement: SVGPathElement, point: TerritoryAnchor) {
  try {
    return pathElement.isPointInFill(point);
  } catch {
    return false;
  }
}

export function getTerritoryAnchor(pathElement: SVGPathElement): TerritoryAnchor {
  const bbox = pathElement.getBBox();
  const bboxCenter = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };

  if (bbox.width <= 0 || bbox.height <= 0) {
    return bboxCenter;
  }

  const boundary = sampleBoundary(pathElement);
  if (!boundary.length) return bboxCenter;

  if (typeof pathElement.isPointInFill !== "function") {
    return boundary[Math.floor(boundary.length / 2)];
  }

  let bestPoint: TerritoryAnchor | null = null;
  let bestClearance = -1;

  const consider = (point: TerritoryAnchor) => {
    if (!isInside(pathElement, point)) return;

    const clearance = clearanceFromBoundary(point, boundary);
    if (clearance > bestClearance) {
      bestPoint = point;
      bestClearance = clearance;
    }
  };

  // O centro do bounding box é barato e continua ótimo para formas regulares,
  // mas não é confiável para territórios côncavos ou muito assimétricos.
  consider(bboxCenter);

  // Procura um ponto garantidamente interno e afastado da borda. Isso aproxima
  // o "pole of inaccessibility" sem dependências extras e roda apenas ao carregar
  // os 42 paths do mapa.
  const divisions = 17;
  for (let row = 0; row < divisions; row += 1) {
    for (let column = 0; column < divisions; column += 1) {
      consider({
        x: bbox.x + ((column + 0.5) / divisions) * bbox.width,
        y: bbox.y + ((row + 0.5) / divisions) * bbox.height,
      });
    }
  }

  if (!bestPoint) {
    // Formas extremamente estreitas podem não cruzar a malha grossa.
    const fallbackDivisions = 33;
    for (let row = 0; row < fallbackDivisions; row += 1) {
      for (let column = 0; column < fallbackDivisions; column += 1) {
        consider({
          x: bbox.x + ((column + 0.5) / fallbackDivisions) * bbox.width,
          y: bbox.y + ((row + 0.5) / fallbackDivisions) * bbox.height,
        });
      }
    }
  }

  if (!bestPoint) {
    // Última tentativa para polígonos muito finos: cordas entre pontos opostos
    // da borda costumam atravessar o interior mesmo quando a grade não o acerta.
    const half = Math.floor(boundary.length / 2);
    for (let index = 0; index < half; index += 1) {
      const opposite = boundary[(index + half) % boundary.length];
      consider({
        x: (boundary[index].x + opposite.x) / 2,
        y: (boundary[index].y + opposite.y) / 2,
      });
    }
  }

  // Se o browser não encontrar área interior (path degenerado), ancorar na
  // própria borda é preferível a devolver o centro do bbox, que pode estar em
  // outro território.
  return bestPoint ?? boundary[0];
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
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(72, Math.max(28, distance * 0.18));
  const controlX = (from.x + to.x) / 2 - (dy / distance) * bend;
  const controlY = (from.y + to.y) / 2 + (dx / distance) * bend;

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

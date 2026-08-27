import type { MapTargetHint } from "@/src/lib/game-interaction";
import {
  fitTerritoryMarkerSize,
  type TerritoryGeometry,
} from "@/src/lib/territory-geometry";

type TerritorySpecialMarkersProps = {
  targets: readonly MapTargetHint[];
  geometries: ReadonlyMap<number, TerritoryGeometry>;
};

const MARKER_SIZING = {
  preferredScale: 0.3,
  preferredMin: 28,
  maximum: 100,
  safetyFactor: 0.78,
} as const;

function markerAsset(target: MapTargetHint) {
  if (target.kind === "barrier-attack") return "/caveira-vermelha.svg";
  if (target.kind === "barrier-maneuver") return "/alcapao-saida.svg";
  return null;
}

export function TerritorySpecialMarkers({
  targets,
  geometries,
}: TerritorySpecialMarkersProps) {
  const specialTargets = targets.filter(
    (target) => target.kind !== "normal",
  );
  if (!specialTargets.length) return null;

  return (
    <svg
      aria-hidden="true"
      className="game-special-marker-layer pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 1254 1254"
    >
      {specialTargets.map((target) => {
        const geometry = geometries.get(target.territoryId);
        const href = markerAsset(target);
        if (!geometry || !href) return null;

        const size = fitTerritoryMarkerSize(geometry, MARKER_SIZING);
        if (size <= 0) return null;

        return (
          <image
            key={`${target.kind}-${target.territoryId}`}
            href={href}
            x={geometry.x - size / 2}
            y={geometry.y - size / 2}
            width={size}
            height={size}
            preserveAspectRatio="xMidYMid meet"
            opacity={target.selectable ? 1 : 0.58}
            data-kind={target.kind}
            data-territory-id={target.territoryId}
          />
        );
      })}
    </svg>
  );
}

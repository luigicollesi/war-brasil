import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export type GuideSceneTone = "ally" | "enemy" | "accent" | "neutral";

export type GuideSceneMarker = {
  key: string;
  label: string;
  troops: number;
  x: number;
  y: number;
  tone?: GuideSceneTone;
  selected?: boolean;
  moved?: boolean;
};

export type GuideSceneArrow = {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind?: "attack" | "move" | "route";
  label?: ReactNode;
};

function markerStyle(marker: GuideSceneMarker): CSSProperties {
  return {
    left: `${marker.x}%`,
    top: `${marker.y}%`,
  };
}

function arrowPath(arrow: GuideSceneArrow) {
  const midpointX = (arrow.from.x + arrow.to.x) / 2;
  const midpointY = (arrow.from.y + arrow.to.y) / 2;
  const distance = Math.hypot(
    arrow.to.x - arrow.from.x,
    arrow.to.y - arrow.from.y,
  );
  const curve = Math.min(7, Math.max(2.5, distance * 0.12));

  return `M ${arrow.from.x} ${arrow.from.y} Q ${midpointX} ${midpointY - curve} ${arrow.to.x} ${arrow.to.y}`;
}

export function GuideBoardScene({
  ariaLabel,
  markers,
  arrows = [],
  caption,
  className = "",
  compact = false,
}: {
  ariaLabel: string;
  markers: readonly GuideSceneMarker[];
  arrows?: readonly GuideSceneArrow[];
  caption?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <figure
      className={`wb-guide-board-scene ${compact ? "wb-guide-board-scene--compact" : ""} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="wb-guide-board-scene-frame">
        <Image
          src="/war-brasil-42.production.svg"
          alt=""
          fill
          sizes={compact ? "(max-width: 700px) 90vw, 320px" : "(max-width: 900px) 90vw, 520px"}
          className="wb-guide-board-scene-map"
        />

        <svg
          className="wb-guide-board-scene-routes"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker id="guide-attack-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
            <marker id="guide-move-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
          </defs>
          {arrows.map((arrow) => (
            <path
              key={arrow.key}
              d={arrowPath(arrow)}
              data-kind={arrow.kind ?? "route"}
              markerEnd={arrow.kind === "attack" ? "url(#guide-attack-arrow)" : arrow.kind === "move" ? "url(#guide-move-arrow)" : undefined}
            />
          ))}
        </svg>

        {arrows.map((arrow) =>
          arrow.label ? (
            <span
              key={`${arrow.key}-label`}
              className="wb-guide-board-scene-arrow-label"
              data-kind={arrow.kind ?? "route"}
              style={{
                left: `${(arrow.from.x + arrow.to.x) / 2}%`,
                top: `${(arrow.from.y + arrow.to.y) / 2 - 4}%`,
              }}
            >
              {arrow.label}
            </span>
          ) : null,
        )}

        {markers.map((marker) => (
          <div
            key={marker.key}
            className="wb-guide-board-scene-marker"
            data-tone={marker.tone ?? "neutral"}
            data-selected={marker.selected ? "true" : undefined}
            data-moved={marker.moved ? "true" : undefined}
            style={markerStyle(marker)}
            aria-label={`${marker.label}: ${marker.troops} ${marker.troops === 1 ? "tropa" : "tropas"}`}
          >
            <span className="wb-guide-board-scene-troop" aria-hidden="true" />
            <b>{marker.troops}</b>
            <small>{marker.label}</small>
            {marker.moved ? <em>já movidas</em> : null}
          </div>
        ))}
      </div>

      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export type GuideBoardSceneTone = "ally" | "enemy" | "neutral" | "accent";
export type GuideBoardSceneStatus = "default" | "selected" | "target" | "moved";
export type GuideBoardSceneLinkKind = "normal" | "attack" | "maneuver" | "barrier" | "tunnel";

export type GuideBoardSceneMarker = {
  key: string;
  label: string;
  troops: number;
  tone: GuideBoardSceneTone;
  x: number;
  y: number;
  detail?: string;
  status?: GuideBoardSceneStatus;
};

export type GuideBoardSceneLink = {
  key: string;
  from: string;
  to: string;
  kind?: GuideBoardSceneLinkKind;
  directed?: boolean;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(96, Math.max(4, value));
}

export function GuideBoardScene({
  markers,
  links = [],
  ariaLabel,
  caption,
  badge,
  className = "",
}: {
  markers: readonly GuideBoardSceneMarker[];
  links?: readonly GuideBoardSceneLink[];
  ariaLabel: string;
  caption?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  const markerByKey = new Map(markers.map((marker) => [marker.key, marker]));

  return (
    <figure className={`wb-guide-board-scene ${className}`.trim()}>
      <div className="wb-guide-board-scene-stage" role="img" aria-label={ariaLabel}>
        <Image
          src="/war-brasil-42.production.svg"
          alt=""
          fill
          sizes="(max-width: 700px) 92vw, 520px"
          className="wb-guide-board-scene-map"
          aria-hidden="true"
        />

        <svg
          className="wb-guide-board-scene-links"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="wb-guide-board-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6.5"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 4 L 0 8 Z" className="wb-guide-board-arrow-head" />
            </marker>
          </defs>

          {links.map((link) => {
            const from = markerByKey.get(link.from);
            const to = markerByKey.get(link.to);
            if (!from || !to) return null;

            return (
              <line
                key={link.key}
                x1={clampPercent(from.x)}
                y1={clampPercent(from.y)}
                x2={clampPercent(to.x)}
                y2={clampPercent(to.y)}
                data-kind={link.kind ?? "normal"}
                markerEnd={link.directed ? "url(#wb-guide-board-arrow)" : undefined}
              />
            );
          })}
        </svg>

        {markers.map((marker) => (
          <div
            key={marker.key}
            className="wb-guide-board-marker"
            data-tone={marker.tone}
            data-status={marker.status ?? "default"}
            style={
              {
                "--wb-guide-board-x": `${clampPercent(marker.x)}%`,
                "--wb-guide-board-y": `${clampPercent(marker.y)}%`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <span className="wb-guide-board-troops">{Math.max(0, Math.floor(marker.troops))}</span>
            <span className="wb-guide-board-marker-copy">
              <strong>{marker.label}</strong>
              {marker.detail ? <small>{marker.detail}</small> : null}
            </span>
          </div>
        ))}

        {badge ? <div className="wb-guide-board-scene-badge">{badge}</div> : null}
      </div>

      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

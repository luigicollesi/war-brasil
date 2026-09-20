"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  SHOWCASE_TERRITORY_ELEMENT_ID,
  SHOWCASE_TERRITORY_SVG,
} from "@/src/lib/client/store-showcase/territory-showcase-config";
import { resolveTerritoryShowcaseSkin } from "@/src/lib/client/store-showcase/territory-showcase-skin";

type TerritoryShowcaseFallbackProps = Readonly<{
  cosmeticId: string;
  assetRef: string | null;
  effectKey: string | null;
}>;

type SvgBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const DEFAULT_VIEWBOX = "0 0 1254 1254";

export function TerritoryShowcaseFallback({
  cosmeticId,
  assetRef,
  effectKey,
}: TerritoryShowcaseFallbackProps) {
  const shapeRef = useRef<SVGUseElement>(null);
  const [bounds, setBounds] = useState<SvgBounds | null>(null);
  const rawMaskId = useId();
  const maskId = `territory-showcase-mask-${rawMaskId.replaceAll(":", "")}`;
  const href = `${SHOWCASE_TERRITORY_SVG}#${SHOWCASE_TERRITORY_ELEMENT_ID}`;
  const visual = useMemo(
    () => resolveTerritoryShowcaseSkin({ cosmeticId, assetRef, effectKey }),
    [assetRef, cosmeticId, effectKey],
  );

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const measure = () => {
      if (cancelled) return;
      attempts += 1;
      const node = shapeRef.current;
      if (node) {
        try {
          const box = node.getBBox();
          if (box.width > 0 && box.height > 0) {
            setBounds({ x: box.x, y: box.y, width: box.width, height: box.height });
            return;
          }
        } catch {
          // External SVG fragments can report no bounds for the first paint.
        }
      }
      if (attempts < 6) frame = window.requestAnimationFrame(measure);
    };

    frame = window.requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [href]);

  const paddedViewBox = useMemo(() => {
    if (!bounds) return DEFAULT_VIEWBOX;
    const padding = Math.max(bounds.width, bounds.height) * 0.08;
    return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
  }, [bounds]);

  return (
    <svg
      viewBox={paddedViewBox}
      role="img"
      aria-label="Prévia 2D do território canônico"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1254" height="1254" fill="black" />
          <use href={href} fill="white" stroke="white" strokeWidth="2" />
        </mask>
      </defs>

      <use
        ref={shapeRef}
        href={href}
        fill={visual.frontColor}
        stroke={visual.rimColor}
        strokeWidth="5"
        vectorEffect="non-scaling-stroke"
      />

      {visual.skinAssetRef && bounds ? (
        <image
          href={visual.skinAssetRef}
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          preserveAspectRatio="xMidYMid slice"
          opacity={visual.skinOpacity}
          mask={`url(#${maskId})`}
        />
      ) : null}

      <use
        href={href}
        fill="none"
        stroke={visual.rimColor}
        strokeWidth="5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

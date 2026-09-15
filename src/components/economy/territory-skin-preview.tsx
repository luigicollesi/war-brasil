"use client";

import Image from "next/image";
import { useState } from "react";
import { territoryMaterial } from "@/src/lib/client/map/territory-material";
import type { PlayerColor } from "@/src/lib/lobby";

type TerritorySkinPreviewProps = Readonly<{
  assetRef: string | null;
  playerColor?: PlayerColor;
  className?: string;
  ariaLabel?: string;
}>;

export function TerritorySkinPreview({
  assetRef,
  playerColor = "forest",
  className,
  ariaLabel = "Prévia de efeito territorial",
}: TerritorySkinPreviewProps) {
  const [failedAssetRef, setFailedAssetRef] = useState<string | null>(null);
  const material = territoryMaterial(playerColor);
  const showTexture = Boolean(assetRef && failedAssetRef !== assetRef);

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={className}
      data-territory-skin-preview="true"
      data-player-color={playerColor}
      style={{
        position: "relative",
        display: "block",
        overflow: "hidden",
        isolation: "isolate",
        width: "100%",
        aspectRatio: "16 / 10",
        background: `linear-gradient(145deg, ${material.face[0]} 0%, ${material.face[2]} 48%, ${material.face[4]} 100%)`,
        boxShadow: `inset 0 0 0 1px ${material.rim}`,
      }}
    >
      {showTexture ? (
        <Image
          src={assetRef!}
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          sizes="(max-width: 768px) 44vw, 220px"
          onError={() => setFailedAssetRef(assetRef)}
          style={{
            objectFit: "cover",
            opacity: 0.52,
            mixBlendMode: "luminosity",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </span>
  );
}

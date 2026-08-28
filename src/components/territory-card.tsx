"use client";

import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import type { CardSymbol } from "@/src/lib/game-config";

type TerritoryCardProps = {
  territoryId: number | null;
  symbol: CardSymbol | "wild";
  selected?: boolean;
  onClick?: () => void;
};

export function TerritoryCard({
  territoryId,
  symbol,
  selected,
  onClick,
}: TerritoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative aspect-[2/3] w-28 overflow-hidden rounded-xl border bg-[#f9f4df] shadow-sm transition " +
        (selected
          ? "border-[#e4b94f] ring-2 ring-[#e4b94f]"
          : "border-[#17372d]/15 hover:-translate-y-0.5")
      }
      aria-pressed={selected}
    >
      <TerritoryCardArtwork
        territoryId={territoryId}
        symbol={symbol}
        loading="eager"
        className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#f9f4df]"
      />
    </button>
  );
}

"use client";

import Image from "next/image";
import { CARD_LAYOUT, TERRITORY_METADATA, type CardSymbol } from "@/src/lib/game-config";

const symbolAssets: Record<CardSymbol, string> = {
  leaf: "/assets/leaf.svg",
  gold: "/assets/gold-bar.svg",
  water: "/assets/water-drop.svg",
};

type TerritoryCardProps = {
  territoryId: number | null;
  symbol: CardSymbol | "wild";
  selected?: boolean;
  onClick?: () => void;
};

export function TerritoryCard({ territoryId, symbol, selected, onClick }: TerritoryCardProps) {
  const wild = symbol === "wild";
  const territory = territoryId ? TERRITORY_METADATA[territoryId] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={"relative aspect-[2/3] w-28 overflow-hidden rounded-xl border bg-[#f9f4df] shadow-sm transition " + (selected ? "border-[#e4b94f] ring-2 ring-[#e4b94f]" : "border-[#17372d]/15 hover:-translate-y-0.5")}
      aria-pressed={selected}
    >
      <Image src={wild ? "/assets/card-coringa.png" : "/assets/card-template.png"} alt="" fill sizes="112px" className="object-cover" />
      {territory ? (
        <svg className="absolute" style={CARD_LAYOUT.map} viewBox="0 0 1254 1254" aria-hidden="true">
          <use href={`/war-brasil-42.production.svg#territory-${territoryId}`} fill="#326347" stroke="#17372d" strokeWidth="12" />
        </svg>
      ) : null}
      <span className="absolute text-center text-[10px] font-bold leading-tight text-[#17372d]" style={CARD_LAYOUT.name}>
        {wild ? "Coringa" : territory?.name}
      </span>
      {!wild ? <Image src={symbolAssets[symbol]} alt={symbol} width={48} height={48} className="absolute" style={{ left: CARD_LAYOUT.symbol.left, top: CARD_LAYOUT.symbol.top, width: CARD_LAYOUT.symbol.size, height: "auto" }} /> : null}
    </button>
  );
}

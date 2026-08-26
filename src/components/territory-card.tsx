"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CARD_LAYOUT, TERRITORY_METADATA, type CardSymbol } from "@/src/lib/game-config";

const symbolAssets: Record<CardSymbol, string> = {
  leaf: "/leaf.svg",
  gold: "/gold-bar.svg",
  water: "/water-drop.svg",
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

  const territoryUseRef = useRef<SVGUseElement>(null);
  const [territoryViewBox, setTerritoryViewBox] = useState("0 0 1254 1254");

  useEffect(() => {
    setTerritoryViewBox("0 0 1254 1254");

    if (!territoryId) return;

    let frame = 0;
    let attempts = 0;

    const measure = () => {
      const element = territoryUseRef.current;

      if (!element) return;

      try {
        const box = element.getBBox();

        if (box.width > 0 && box.height > 0) {
          // Usa o maior eixo para todos os territórios terem
          // escala visual consistente.
          const size = Math.max(box.width, box.height) * 1.28;

          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;

          setTerritoryViewBox(
            `${centerX - size / 2} ${centerY - size / 2} ${size} ${size}`,
          );

          return;
        }
      } catch {
        // O SVG externo ainda pode não estar pronto.
      }

      attempts += 1;

      if (attempts < 12) {
        frame = requestAnimationFrame(measure);
      }
    };

    frame = requestAnimationFrame(measure);

    return () => cancelAnimationFrame(frame);
  }, [territoryId]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={"relative aspect-[2/3] w-28 overflow-hidden rounded-xl border bg-[#f9f4df] shadow-sm transition " + (selected ? "border-[#e4b94f] ring-2 ring-[#e4b94f]" : "border-[#17372d]/15 hover:-translate-y-0.5")}
      aria-pressed={selected}
    >
      <Image src={wild ? "/card-coringa.png" : "/card-template.png"} alt="" fill sizes="112px" className="object-cover" />
      {territory ? (
        <svg
          className="absolute"
          style={CARD_LAYOUT.map}
          viewBox={territoryViewBox}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <use
            ref={territoryUseRef}
            href={`/war-brasil-42.production.svg#territory-${territoryId}`}
            fill="#326347"
            stroke="#17372d"
            strokeWidth="0"
          />
        </svg>
      ) : null}
      <span className="absolute text-center text-[10px] font-bold leading-tight text-[#17372d]" style={CARD_LAYOUT.name}>
        {wild ? "" : territory?.name}
      </span>
      {!wild ? <Image src={symbolAssets[symbol]} alt={symbol} width={48} height={48} className="absolute" style={{ left: CARD_LAYOUT.symbol.left, top: CARD_LAYOUT.symbol.top, width: CARD_LAYOUT.symbol.size, height: "auto" }} /> : null}
    </button>
  );
}

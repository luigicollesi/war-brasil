"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
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

function territoryNameFontSize(name: string) {
  const characterCount = Array.from(name.trim()).length;
  if (characterCount === 0) return 10.5;

  // O espaço do título corresponde a 76% da largura da carta. Nomes curtos
  // podem usar a tipografia cheia; nomes maiores diminuem progressivamente para
  // permanecer sempre em uma única linha, sem alterar o layout da carta.
  return Math.max(6.25, Math.min(10.5, 145 / Math.max(characterCount, 14)));
}

export function TerritoryCard({ territoryId, symbol, selected, onClick }: TerritoryCardProps) {
  const wild = symbol === "wild";
  const territory = territoryId ? TERRITORY_METADATA[territoryId] : null;
  const territoryName = wild ? "" : territory?.name ?? "";
  const territoryNameSize = territoryNameFontSize(territoryName);

  const territorySvgRef = useRef<SVGSVGElement>(null);
  const territoryUseRef = useRef<SVGUseElement>(null);

  useEffect(() => {
    const svg = territorySvgRef.current;

    if (!svg) return;

    // Reset imperativo do elemento DOM, sem provocar render React.
    svg.setAttribute("viewBox", "0 0 1254 1254");

    if (!territoryId) return;

    let frame = 0;
    let attempts = 0;

    const measure = () => {
      const element = territoryUseRef.current;
      const currentSvg = territorySvgRef.current;

      if (!element || !currentSvg) return;

      try {
        const box = element.getBBox();

        if (box.width > 0 && box.height > 0) {
          const size = Math.max(box.width, box.height) * 1.28;

          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;

          currentSvg.setAttribute(
            "viewBox",
            `${centerX - size / 2} ${centerY - size / 2} ${size} ${size}`,
          );

          return;
        }
      } catch {
        // O <use> externo pode precisar de mais um frame para resolver.
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
      <Image
        src={wild ? "/card-coringa.png" : "/card-template.png"}
        alt=""
        fill
        sizes="112px"
        loading="eager"
        className="object-cover"
      />
      {territory ? (
        <svg
          ref={territorySvgRef}
          className="absolute"
          style={CARD_LAYOUT.map}
          viewBox="0 0 1254 1254"
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
      <span
        className="absolute text-center font-bold text-[#17372d]"
        style={{
          ...CARD_LAYOUT.name,
          display: "block",
          fontSize: `${territoryNameSize}px`,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "clip",
        }}
      >
        {territoryName}
      </span>
      {!wild ? <Image src={symbolAssets[symbol]} alt={symbol} width={48} height={48} className="absolute" style={{ left: CARD_LAYOUT.symbol.left, top: CARD_LAYOUT.symbol.top, width: CARD_LAYOUT.symbol.size, height: "auto" }} /> : null}
    </button>
  );
}

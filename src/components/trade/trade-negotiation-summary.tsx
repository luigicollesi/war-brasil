import type { GameTradeTerms } from "@/src/lib/shared/game-contract";
import { tradeDescriptorLabel } from "./trade-ui-helpers";

export function TradeNegotiationSummary({
  label,
  terms,
}: {
  label: string;
  terms: GameTradeTerms;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9eb0a8]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-[#8fa39a]">
            Oferece
          </span>
          <strong>{tradeDescriptorLabel(terms.offered)}</strong>
        </div>
        <span className="text-[#d9b650]">↔</span>
        <div className="text-right">
          <span className="block text-[10px] uppercase tracking-wider text-[#8fa39a]">
            Quer
          </span>
          <strong>{tradeDescriptorLabel(terms.requested)}</strong>
        </div>
      </div>
      <span className="sr-only">
        Negociação visível para todos os jogadores da sala.
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { GameCard, GameSnapshot } from "@/src/lib/shared/game-contract";
import { TERRITORY_METADATA } from "@/src/lib/shared/game-config";
import type { TradeCardDescriptor } from "@/src/lib/shared/game-trade-rules";
import {
  sameTradeDescriptor,
  TRADE_SYMBOLS,
  tradePlayerColor,
} from "./trade-ui-helpers";

function symbolCounts(cards: readonly GameCard[]) {
  return TRADE_SYMBOLS.map(({ symbol, label }) => ({
    symbol,
    label,
    count: cards.filter((card) => card.symbol === symbol).length,
  }));
}

function TerritoryDescriptorButton({
  territoryId,
  value,
  onChange,
}: {
  territoryId: number;
  value: TradeCardDescriptor | null;
  onChange: (descriptor: TradeCardDescriptor) => void;
}) {
  const descriptor: TradeCardDescriptor = { kind: "territory", territoryId };
  return (
    <button
      type="button"
      onClick={() => onChange(descriptor)}
      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
        sameTradeDescriptor(value, descriptor)
          ? "border-[#e4b94f] bg-[#e4b94f]/15 text-[#f3d77f]"
          : "border-white/10 bg-white/5 text-[#e8eee9]"
      }`}
    >
      {TERRITORY_METADATA[territoryId]?.name ?? `Território ${territoryId}`}
    </button>
  );
}

export function TradeDescriptorPicker({
  mode,
  snapshot,
  value,
  onChange,
}: {
  mode: "owned" | "request";
  snapshot: GameSnapshot;
  value: TradeCardDescriptor | null;
  onChange: (descriptor: TradeCardDescriptor) => void;
}) {
  const [search, setSearch] = useState("");
  const me = snapshot.players.find((player) => player.isMe);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const counts = symbolCounts(snapshot.myCards);
  const wildCount = snapshot.myCards.filter((card) => card.symbol === "wild").length;

  const ownedTerritoryIds = Array.from(
    new Set(
      snapshot.myCards.flatMap((card) =>
        card.symbol !== "wild" && card.territoryId !== null ? [card.territoryId] : [],
      ),
    ),
  ).sort((left, right) =>
    (TERRITORY_METADATA[left]?.name ?? "").localeCompare(
      TERRITORY_METADATA[right]?.name ?? "",
      "pt-BR",
    ),
  );

  const requestedTerritoryIds = Object.keys(TERRITORY_METADATA)
    .map(Number)
    .filter((territoryId) => {
      if (!normalizedSearch) return true;
      return TERRITORY_METADATA[territoryId]?.name
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    });

  const playerOrder = [...snapshot.players]
    .filter((player) => player.turnPosition !== null)
    .sort((left, right) => {
      if (left.id === me?.id) return -1;
      if (right.id === me?.id) return 1;
      return (left.turnPosition ?? 999) - (right.turnPosition ?? 999);
    });

  const requestGroups = playerOrder
    .map((player) => ({
      player,
      territories: requestedTerritoryIds
        .filter(
          (territoryId) =>
            snapshot.territories.find((item) => item.territoryId === territoryId)
              ?.ownerPlayerId === player.id,
        )
        .sort((left, right) =>
          (TERRITORY_METADATA[left]?.name ?? "").localeCompare(
            TERRITORY_METADATA[right]?.name ?? "",
            "pt-BR",
          ),
        ),
    }))
    .filter((group) => group.territories.length > 0);

  const ungroupedRequested = requestedTerritoryIds
    .filter(
      (territoryId) =>
        !snapshot.territories.some((item) => item.territoryId === territoryId),
    )
    .sort((left, right) =>
      (TERRITORY_METADATA[left]?.name ?? "").localeCompare(
        TERRITORY_METADATA[right]?.name ?? "",
        "pt-BR",
      ),
    );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b7a27]">
          Símbolos
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {counts.map(({ symbol, label, count }) => {
            if (mode === "owned" && count === 0) return null;
            const descriptor: TradeCardDescriptor = { kind: "symbol", symbol };
            return (
              <button
                key={symbol}
                type="button"
                onClick={() => onChange(descriptor)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  sameTradeDescriptor(value, descriptor)
                    ? "border-[#e4b94f] bg-[#e4b94f] text-[#12392f]"
                    : "border-white/15 bg-white/5 text-[#e8eee9]"
                }`}
              >
                {label}
                {mode === "owned" ? ` ×${count}` : ` · você possui ${count}`}
              </button>
            );
          })}
          {(mode === "request" || wildCount > 0) && (
            <button
              type="button"
              onClick={() => onChange({ kind: "wild" })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                value?.kind === "wild"
                  ? "border-[#e4b94f] bg-[#e4b94f] text-[#12392f]"
                  : "border-white/15 bg-white/5 text-[#e8eee9]"
              }`}
            >
              Coringa
              {mode === "owned" ? ` ×${wildCount}` : ` · você possui ${wildCount}`}
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b7a27]">
            Territórios
          </p>
          {mode === "request" ? (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar território"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-[#8fa39a] focus:border-[#e4b94f]"
            />
          ) : null}
        </div>

        <div className="mt-3 max-h-[38vh] space-y-4 overflow-y-auto pr-1">
          {mode === "owned" ? (
            ownedTerritoryIds.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {ownedTerritoryIds.map((territoryId) => (
                  <TerritoryDescriptorButton
                    key={territoryId}
                    territoryId={territoryId}
                    value={value}
                    onChange={onChange}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#9eb0a8]">
                Você não possui cartas de território disponíveis.
              </p>
            )
          ) : (
            <>
              {requestGroups.map(({ player, territories }) => (
                <div key={player.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tradePlayerColor(player) }}
                    />
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#b9cbc3]">
                      {player.id === me?.id ? "Seus territórios" : player.factionName}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {territories.map((territoryId) => (
                      <TerritoryDescriptorButton
                        key={territoryId}
                        territoryId={territoryId}
                        value={value}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {ungroupedRequested.length > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b9cbc3]">
                    Outros
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ungroupedRequested.map((territoryId) => (
                      <TerritoryDescriptorButton
                        key={territoryId}
                        territoryId={territoryId}
                        value={value}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {requestedTerritoryIds.length === 0 ? (
                <p className="text-sm text-[#9eb0a8]">Nenhum território encontrado.</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

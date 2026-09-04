"use client";

import { useEffect, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { TerritoryCard } from "@/src/components/territory-card";
import { runGameCommand } from "@/src/lib/client/game-command-client";
import { sendTradeSignal } from "@/src/lib/client/game-trade-client";
import type {
  GameCard,
  GamePlayer,
  GameSnapshot,
  GameTradeTerms,
} from "@/src/lib/shared/game-contract";
import { TERRITORY_METADATA, type CardSymbol } from "@/src/lib/shared/game-config";
import {
  cardsMatchingTradeDescriptor,
  type TradeCardDescriptor,
} from "@/src/lib/shared/game-trade-rules";
import { PLAYER_COLORS } from "@/src/lib/shared/lobby";

type TradePhasePanelProps = {
  roomId: string;
  snapshot: GameSnapshot;
  onRefresh: (minimumRevision?: number) => Promise<void>;
};

type BuilderMode = "offer" | "counter";

const SYMBOLS: Array<{ symbol: CardSymbol; label: string }> = [
  { symbol: "leaf", label: "Folha" },
  { symbol: "gold", label: "Ouro" },
  { symbol: "water", label: "Água" },
];

function playerColor(player: GamePlayer) {
  return PLAYER_COLORS.find((color) => color.value === player.color)?.hex ?? "#17372d";
}

function playerName(snapshot: GameSnapshot, playerId: string) {
  return snapshot.players.find((player) => player.id === playerId)?.factionName ?? "Jogador";
}

function descriptorLabel(descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return "Coringa";
  if (descriptor.kind === "symbol") {
    return SYMBOLS.find((item) => item.symbol === descriptor.symbol)?.label ?? descriptor.symbol;
  }
  return (
    TERRITORY_METADATA[descriptor.territoryId]?.name ??
    `Território ${descriptor.territoryId}`
  );
}

function descriptorKey(descriptor: TradeCardDescriptor) {
  if (descriptor.kind === "wild") return "wild";
  if (descriptor.kind === "symbol") return `symbol:${descriptor.symbol}`;
  return `territory:${descriptor.territoryId}`;
}

function sameDescriptor(
  left: TradeCardDescriptor | null,
  right: TradeCardDescriptor,
) {
  return Boolean(left && descriptorKey(left) === descriptorKey(right));
}

function symbolCounts(cards: readonly GameCard[]) {
  return SYMBOLS.map(({ symbol, label }) => ({
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
        sameDescriptor(value, descriptor)
          ? "border-[#e4b94f] bg-[#e4b94f]/15 text-[#f3d77f]"
          : "border-white/10 bg-white/5 text-[#e8eee9]"
      }`}
    >
      {TERRITORY_METADATA[territoryId]?.name ?? `Território ${territoryId}`}
    </button>
  );
}

function TradeDescriptorPicker({
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
                  sameDescriptor(value, descriptor)
                    ? "border-[#e4b94f] bg-[#e4b94f] text-[#12392f]"
                    : "border-white/15 bg-white/5 text-[#e8eee9]"
                }`}
              >
                {label}{mode === "owned" ? ` ×${count}` : ` · você possui ${count}`}
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
              Coringa{mode === "owned" ? ` ×${wildCount}` : ` · você possui ${wildCount}`}
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
                      style={{ backgroundColor: playerColor(player) }}
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

function TradeBuilderModal({
  mode,
  snapshot,
  offerId,
  onClose,
  onSubmit,
}: {
  mode: BuilderMode;
  snapshot: GameSnapshot;
  offerId?: string;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const me = snapshot.players.find((player) => player.isMe);
  const candidates = snapshot.players.filter(
    (player) =>
      player.id !== me?.id &&
      !player.isBot &&
      player.turnPosition !== null,
  );
  const [targetPlayerId, setTargetPlayerId] = useState(
    mode === "counter" ? snapshot.room.currentPlayerId ?? "" : candidates[0]?.id ?? "",
  );
  const [offered, setOffered] = useState<TradeCardDescriptor | null>(null);
  const [requested, setRequested] = useState<TradeCardDescriptor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!offered || !requested || !targetPlayerId || submitting) return;
    setSubmitting(true);
    try {
      const success = await onSubmit(
        mode === "offer"
          ? { action: "offer", targetPlayerId, offered, requested }
          : { action: "counter", offerId, offered, requested },
      );
      if (success) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GameModal
      eyebrow={mode === "offer" ? "Fase de troca" : "Resposta à oferta"}
      title={mode === "offer" ? "Solicitar troca" : "Contraofertar"}
      onClose={submitting ? undefined : onClose}
      className="trade-modal w-full max-w-3xl p-5 sm:p-6"
    >
      <div className="mt-4 max-h-[72dvh] space-y-6 overflow-y-auto pr-1">
        {mode === "offer" ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b7a27]">
              Com quem?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setTargetPlayerId(player.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    targetPlayerId === player.id
                      ? "border-[#e4b94f] bg-[#e4b94f]/15 text-[#f3d77f]"
                      : "border-white/15 bg-white/5 text-[#e8eee9]"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: playerColor(player) }}
                  />
                  {player.factionName}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <h4 className="text-sm font-semibold text-white">Ofereço</h4>
            <p className="mb-4 mt-1 text-xs text-[#9eb0a8]">
              Só aparecem opções que sua mão realmente pode entregar.
            </p>
            <TradeDescriptorPicker
              mode="owned"
              snapshot={snapshot}
              value={offered}
              onChange={setOffered}
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <h4 className="text-sm font-semibold text-white">Quero</h4>
            <p className="mb-4 mt-1 text-xs text-[#9eb0a8]">
              Você pode pedir qualquer território, símbolo ou coringa.
            </p>
            <TradeDescriptorPicker
              mode="request"
              snapshot={snapshot}
              value={requested}
              onChange={setRequested}
            />
          </section>
        </div>

        <div className="rounded-2xl border border-[#e4b94f]/20 bg-[#e4b94f]/5 p-4 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9b650]">
            Resumo
          </p>
          <p className="mt-2 text-[#dce7e1]">
            {mode === "offer"
              ? `Para ${playerName(snapshot, targetPlayerId)}`
              : `Para ${playerName(snapshot, snapshot.room.currentPlayerId ?? "")}`}
          </p>
          <p className="mt-1 text-white">
            {offered ? descriptorLabel(offered) : "—"} ↔ {requested ? descriptorLabel(requested) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={!offered || !requested || !targetPlayerId || submitting}
          onClick={() => void submit()}
          className="flex-1 rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#12392f] disabled:opacity-40"
        >
          {submitting ? "Enviando…" : mode === "offer" ? "Enviar oferta" : "Enviar contraoferta"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#dce7e1]"
        >
          Cancelar
        </button>
      </div>
    </GameModal>
  );
}

function NegotiationTerms({
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
          <span className="block text-[10px] uppercase tracking-wider text-[#8fa39a]">Oferece</span>
          <strong>{descriptorLabel(terms.offered)}</strong>
        </div>
        <span className="text-[#d9b650]">↔</span>
        <div className="text-right">
          <span className="block text-[10px] uppercase tracking-wider text-[#8fa39a]">Quer</span>
          <strong>{descriptorLabel(terms.requested)}</strong>
        </div>
      </div>
      <span className="sr-only">Negociação visível para todos os jogadores da sala.</span>
    </div>
  );
}

function PendingCardSelectionModal({
  snapshot,
  onSubmit,
}: {
  snapshot: GameSnapshot;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const pending = snapshot.trade?.myPendingSelection;
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  if (!pending) return null;

  const cards = cardsMatchingTradeDescriptor(snapshot.myCards, pending.descriptor);

  return (
    <GameModal
      eyebrow="Troca aceita"
      title={`Escolha sua carta ${descriptorLabel(pending.descriptor)}`}
      className="trade-modal w-full max-w-xl p-5 sm:p-6"
    >
      <p className="mt-2 text-sm text-[#b8cac2]">
        A negociação já foi aceita. Escolha qual carta será entregue para concluir a troca.
      </p>
      <div className="mt-5 grid max-h-[58dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={submittingId !== null ? "pointer-events-none opacity-50" : ""}
          >
            <TerritoryCard
              territoryId={card.territoryId}
              symbol={card.symbol}
              onClick={() => {
                if (submittingId !== null) return;
                setSubmittingId(card.id);
                void onSubmit({
                  action: "selectCard",
                  offerId: pending.offerId,
                  cardId: card.id,
                }).finally(() => setSubmittingId(null));
              }}
            />
          </div>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-[#f0a090]" role="alert">
          Sua mão mudou e não há mais uma carta compatível. Atualize a partida para recuperar o estado.
        </p>
      ) : null}
    </GameModal>
  );
}

function SignalModal({
  snapshot,
  onClose,
  onSignal,
}: {
  snapshot: GameSnapshot;
  onClose: () => void;
  onSignal: (descriptor: TradeCardDescriptor) => Promise<void>;
}) {
  const [descriptor, setDescriptor] = useState<TradeCardDescriptor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <GameModal
      eyebrow="Fase de troca"
      title="Notificar posse"
      onClose={submitting ? undefined : onClose}
      className="trade-modal w-full max-w-xl p-5 sm:p-6"
    >
      <p className="mt-2 text-sm text-[#b8cac2]">
        A informação será pública por alguns segundos e não ficará no histórico.
      </p>
      <div className="mt-5 max-h-[64dvh] overflow-y-auto pr-1">
        <TradeDescriptorPicker
          mode="owned"
          snapshot={snapshot}
          value={descriptor}
          onChange={setDescriptor}
        />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={!descriptor || submitting}
          onClick={() => {
            if (!descriptor) return;
            setSubmitting(true);
            void onSignal(descriptor)
              .then(onClose)
              .finally(() => setSubmitting(false));
          }}
          className="flex-1 rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#12392f] disabled:opacity-40"
        >
          {submitting ? "Enviando…" : "Notificar"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="rounded-xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#dce7e1]"
        >
          Cancelar
        </button>
      </div>
    </GameModal>
  );
}

export function TradePhasePanel({
  roomId,
  snapshot,
  onRefresh,
}: TradePhasePanelProps) {
  const trade = snapshot.trade;
  const me = snapshot.players.find((player) => player.isMe);
  const [builder, setBuilder] = useState<BuilderMode | null>(null);
  const [signalOpen, setSignalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [localSignalsUsed, setLocalSignalsUsed] = useState(trade?.signalsUsed ?? 0);

  useEffect(() => {
    setLocalSignalsUsed(trade?.signalsUsed ?? 0);
    setBuilder(null);
    setSignalOpen(false);
  }, [
    snapshot.room.turnNumber,
    snapshot.room.currentPlayerId,
    snapshot.room.phase,
    trade?.signalsUsed,
  ]);

  if (!trade || !me) return null;

  const isTurn = snapshot.room.currentPlayerId === me.id;
  const activeOffer = trade.activeOffer;
  const remainingOffers = Math.max(0, trade.offerLimit - trade.offersUsed);
  const remainingSignals = Math.max(0, trade.signalLimit - localSignalsUsed);
  const isTarget = activeOffer?.targetPlayerId === me.id;
  const isOriginalProposer = activeOffer?.proposerPlayerId === me.id;
  const counter = activeOffer?.counter ?? null;
  const eligibleTargets = snapshot.players.filter(
    (player) =>
      player.id !== me.id && !player.isBot && player.turnPosition !== null,
  );
  const canAcceptOriginal = Boolean(
    activeOffer &&
      activeOffer.status === "open" &&
      cardsMatchingTradeDescriptor(snapshot.myCards, activeOffer.original.requested).length > 0,
  );
  const canAcceptCounter = Boolean(
    activeOffer &&
      counter &&
      activeOffer.status === "countered" &&
      cardsMatchingTradeDescriptor(snapshot.myCards, counter.terms.requested).length > 0,
  );
  const canSignal =
    !isTurn &&
    !me.isBot &&
    me.turnPosition !== null &&
    snapshot.myCards.length > 0 &&
    remainingSignals > 0;

  async function command(body: Record<string, unknown>) {
    setMessage("");
    const action = typeof body.action === "string" ? body.action : "trade";
    setBusyAction(action);
    try {
      const result = await runGameCommand(roomId, "trade", body);
      await onRefresh(result.revision ?? undefined);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível concluir a negociação.",
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function signal(descriptor: TradeCardDescriptor) {
    setMessage("");
    try {
      const result = await sendTradeSignal(roomId, descriptor);
      setLocalSignalsUsed(result.signalsUsed);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível enviar a sinalização.",
      );
      throw error;
    }
  }

  return (
    <div className="trade-phase-panel mt-5 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9b650]">
          Fase de troca
        </p>
        <h3 className="mt-1 text-base font-semibold text-white">
          Negocie cartas ou siga direto para os reforços.
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isTurn ? (
          <>
            <span className="rounded-full border border-[#e4b94f]/25 bg-[#e4b94f]/10 px-3 py-1 text-xs font-semibold text-[#f1d278]">
              {remainingOffers} {remainingOffers === 1 ? "oferta restante" : "ofertas restantes"}
            </span>
            {!activeOffer && remainingOffers > 0 && eligibleTargets.length > 0 ? (
              <button
                type="button"
                onClick={() => setBuilder("offer")}
                className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]"
              >
                Solicitar troca
              </button>
            ) : null}
            <button
              type="button"
              disabled={Boolean(activeOffer) || busyAction !== null}
              onClick={() => void command({ action: "finish" })}
              className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
            >
              Iniciar reforços
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-[#b9cbc3]">
              Negociações de {playerName(snapshot, snapshot.room.currentPlayerId ?? "")}.
            </span>
            {canSignal ? (
              <button
                type="button"
                onClick={() => setSignalOpen(true)}
                className="rounded-xl border border-[#e4b94f]/30 bg-[#e4b94f]/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f1d278]"
              >
                Notificar posse · {remainingSignals}
              </button>
            ) : null}
          </>
        )}
      </div>

      {isTurn && eligibleTargets.length === 0 && !activeOffer ? (
        <p className="text-xs text-[#9eb0a8]">
          Não há outro jogador humano ativo disponível para negociação.
        </p>
      ) : null}

      {activeOffer ? (
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9b650]">
                Negociação pública
              </p>
              <p className="mt-1 text-sm text-[#dce7e1]">
                {playerName(snapshot, activeOffer.proposerPlayerId)} → {playerName(snapshot, activeOffer.targetPlayerId)}
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9eb0a8]">
              {activeOffer.status === "open"
                ? "Aguardando resposta"
                : activeOffer.status === "countered"
                  ? "Contraoferta"
                  : "Troca aceita"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <NegotiationTerms
              label={`Oferta de ${playerName(snapshot, activeOffer.proposerPlayerId)}`}
              terms={activeOffer.original}
            />
            {counter ? (
              <NegotiationTerms
                label={`Contraoferta de ${playerName(snapshot, counter.proposerPlayerId)}`}
                terms={counter.terms}
              />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {activeOffer.status === "open" && isTarget ? (
              <>
                {canAcceptOriginal ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void command({ action: "accept", offerId: activeOffer.id })}
                    className="rounded-xl bg-[#e4b94f] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
                  >
                    Aceitar
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setBuilder("counter")}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
                >
                  Contraofertar
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void command({ action: "decline", offerId: activeOffer.id })}
                  className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
                >
                  Recusar
                </button>
              </>
            ) : null}

            {activeOffer.status === "open" && isOriginalProposer ? (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void command({ action: "cancel", offerId: activeOffer.id })}
                className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
              >
                Cancelar oferta
              </button>
            ) : null}

            {activeOffer.status === "countered" && isOriginalProposer && counter ? (
              <>
                {canAcceptCounter ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void command({ action: "acceptCounter", offerId: activeOffer.id })
                    }
                    className="rounded-xl bg-[#e4b94f] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
                  >
                    Aceitar contraoferta
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void command({ action: "decline", offerId: activeOffer.id })}
                  className="rounded-xl border border-[#b65a4c]/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f2a99d] disabled:opacity-40"
                >
                  Recusar
                </button>
              </>
            ) : null}
          </div>

          {activeOffer.status === "accepted_pending_selection" && !trade.myPendingSelection ? (
            <p className="mt-4 text-sm text-[#b9cbc3]">
              Troca aceita. Aguardando a seleção privada da carta necessária.
            </p>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[#f0a090]" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      {builder ? (
        <TradeBuilderModal
          mode={builder}
          snapshot={snapshot}
          offerId={activeOffer?.id}
          onClose={() => setBuilder(null)}
          onSubmit={command}
        />
      ) : null}

      {signalOpen ? (
        <SignalModal
          snapshot={snapshot}
          onClose={() => setSignalOpen(false)}
          onSignal={signal}
        />
      ) : null}

      <PendingCardSelectionModal snapshot={snapshot} onSubmit={command} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { TradeCardDescriptor } from "@/src/lib/shared/game-trade-rules";
import { TradeDescriptorPicker } from "./trade-descriptor-picker";
import {
  tradeDescriptorLabel,
  tradePlayerColor,
  tradePlayerName,
} from "./trade-ui-helpers";

export type TradeBuilderMode = "offer" | "counter";

export function TradeBuilderModal({
  mode,
  snapshot,
  offerId,
  onClose,
  onSubmit,
}: {
  mode: TradeBuilderMode;
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
    mode === "counter"
      ? snapshot.room.currentPlayerId ?? ""
      : candidates[0]?.id ?? "",
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
                    style={{ backgroundColor: tradePlayerColor(player) }}
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
              ? `Para ${tradePlayerName(snapshot, targetPlayerId)}`
              : `Para ${tradePlayerName(snapshot, snapshot.room.currentPlayerId ?? "")}`}
          </p>
          <p className="mt-1 text-white">
            {offered ? tradeDescriptorLabel(offered) : "—"} ↔{" "}
            {requested ? tradeDescriptorLabel(requested) : "—"}
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
          {submitting
            ? "Enviando…"
            : mode === "offer"
              ? "Enviar oferta"
              : "Enviar contraoferta"}
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

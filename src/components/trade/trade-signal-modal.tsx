"use client";

import { useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import type { GameSnapshot } from "@/src/lib/shared/game-contract";
import type { TradeCardDescriptor } from "@/src/lib/shared/game-trade-rules";
import { TradeDescriptorPicker } from "./trade-descriptor-picker";

export function TradeSignalModal({
  snapshot,
  onClose,
  onSignal,
}: {
  snapshot: GameSnapshot;
  onClose: () => void;
  onSignal: (descriptor: TradeCardDescriptor) => Promise<boolean>;
}) {
  const [descriptor, setDescriptor] = useState<TradeCardDescriptor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!descriptor || submitting) return;
    setSubmitting(true);
    try {
      if (await onSignal(descriptor)) onClose();
    } finally {
      setSubmitting(false);
    }
  }

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
          onClick={() => void submit()}
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

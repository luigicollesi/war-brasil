"use client";

import { GameModal } from "@/src/components/game-modal";
import { TemporalAnomalyEffectList } from "@/src/components/temporal-anomaly-effect-list";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

type TemporalAnomalyModalProps = {
  presentation: TemporalAnomalyPresentation;
  onClose: () => void;
};

export function TemporalAnomalyModal({
  presentation,
  onClose,
}: TemporalAnomalyModalProps) {
  return (
    <GameModal
      eyebrow={presentation.eyebrow}
      title={presentation.title}
      tone="event"
      className="temporal-anomaly-modal w-full max-w-2xl p-6 sm:p-8"
      onClose={onClose}
    >
      <span className="temporal-anomaly-round">
        Rodada {presentation.roundNumber}
      </span>

      <p className="temporal-anomaly-description">{presentation.description}</p>

      <TemporalAnomalyEffectList effects={presentation.effects} />

      <button
        type="button"
        onClick={onClose}
        className="game-primary-action temporal-anomaly-continue h-11 w-full rounded-xl px-5 text-xs font-bold uppercase tracking-[0.14em]"
      >
        {presentation.roundNumber === 1 ? "Iniciar" : "Continuar"}
      </button>
    </GameModal>
  );
}

"use client";

import { GameModal } from "@/src/components/game-modal";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

type TemporalAnomalyModalProps = {
  presentation: TemporalAnomalyPresentation;
  onClose: () => void;
};

const effectMarker: Record<
  TemporalAnomalyPresentation["effects"][number]["kind"],
  string
> = {
  "troops-added": "+",
  "troops-removed": "−",
  "attack-blocked": "×",
  "connection-opened": "↔",
  "connection-blocked": "∥",
  "barrier-moved": "⇢",
  information: "•",
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

      {presentation.effects.length ? (
        <section
          className="temporal-anomaly-effects"
          aria-labelledby="temporal-anomaly-effects-heading"
        >
          <p
            id="temporal-anomaly-effects-heading"
            className="temporal-anomaly-effects-heading"
          >
            Efeitos
          </p>
          <ul>
            {presentation.effects.map((effect, index) => (
              <li key={`${effect.kind}-${effect.primary}-${index}`}>
                <span
                  aria-hidden="true"
                  className="temporal-anomaly-effect-icon"
                  data-kind={effect.kind}
                >
                  {effectMarker[effect.kind]}
                </span>
                <span className="temporal-anomaly-effect-copy">
                  <small>{effect.label}</small>
                  <strong>{effect.primary}</strong>
                  {effect.secondary ? <span>{effect.secondary}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

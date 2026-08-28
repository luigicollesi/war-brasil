"use client";

import { GameModal } from "@/src/components/game-modal";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

type TemporalAnomalyModalProps = {
  presentation: TemporalAnomalyPresentation;
  onClose: () => void;
};

const changeMarker: Record<
  TemporalAnomalyPresentation["changes"][number]["kind"],
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
      className="w-full max-w-2xl p-6 sm:p-8"
      onClose={onClose}
    >
      <div className="mt-5 space-y-5 text-sm leading-6 text-[#d6e3dd]">
        <div className="rounded-2xl bg-white/6 px-4 py-3">
          <p className="font-semibold text-[#f4d978]">
            {presentation.tunnelMessage}
          </p>
          <p className="mt-2 text-[#abc0b7]">{presentation.contextMessage}</p>
        </div>

        <p className="text-[#e6ede8]">{presentation.description}</p>

        <section aria-labelledby="temporal-anomaly-changes-heading">
          <p
            id="temporal-anomaly-changes-heading"
            className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#d9b650]"
          >
            {presentation.changesHeading}
          </p>
          <ul className="mt-3 space-y-2">
            {presentation.changes.map((change, index) => (
              <li
                key={`${change.kind}-${index}`}
                className="flex gap-3 rounded-xl bg-white/5 px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#d9b650]/12 text-xs font-black text-[#e7c968]"
                >
                  {changeMarker[change.kind]}
                </span>
                <span>{change.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-xl bg-[#e4b94f] px-5 text-xs font-bold uppercase tracking-[0.14em] text-[#12392f] transition hover:bg-[#f1ca68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4d978] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12392f]"
        >
          Fechar anomalia
        </button>
      </div>
    </GameModal>
  );
}

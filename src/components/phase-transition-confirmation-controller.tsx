"use client";

import { useEffect, useRef, useState } from "react";
import { GameModal } from "@/src/components/game-modal";

type TransitionKind = "finishAttack" | "endTurn";

type PendingTransition = {
  kind: TransitionKind;
  button: HTMLButtonElement;
};

const TRANSITION_BY_LABEL: Record<string, TransitionKind> = {
  "Ir para deslocamento": "finishAttack",
  "Encerrar turno": "endTurn",
};

const TRANSITION_COPY: Record<
  TransitionKind,
  {
    eyebrow: string;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }
> = {
  finishAttack: {
    eyebrow: "Confirmar mudança de fase",
    title: "Encerrar ataques?",
    description:
      "Ao confirmar, você encerra a fase de ataque e passa para o deslocamento de tropas. Não será possível voltar a atacar neste turno.",
    confirmLabel: "Ir para deslocamento",
    cancelLabel: "Continuar atacando",
  },
  endTurn: {
    eyebrow: "Confirmar fim do turno",
    title: "Encerrar turno?",
    description:
      "Ao confirmar, a fase de deslocamento termina e a vez passa para o próximo jogador.",
    confirmLabel: "Encerrar turno",
    cancelLabel: "Continuar deslocando",
  },
};

function normalizedButtonLabel(button: HTMLButtonElement) {
  return button.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function PhaseTransitionConfirmationController() {
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const bypassButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const runtime = document.querySelector<HTMLElement>(".game-runtime");
    if (!runtime) return;

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || !runtime.contains(button) || button.disabled) return;

      if (bypassButtonRef.current === button) {
        bypassButtonRef.current = null;
        return;
      }

      const kind = TRANSITION_BY_LABEL[normalizedButtonLabel(button)];
      if (!kind) return;

      event.preventDefault();
      event.stopPropagation();
      setPending({ kind, button });
    };

    runtime.addEventListener("click", onClickCapture, true);
    return () => {
      runtime.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  if (!pending) return null;

  const copy = TRANSITION_COPY[pending.kind];

  const confirm = () => {
    const button = pending.button;
    setPending(null);

    if (!button.isConnected || button.disabled) return;

    bypassButtonRef.current = button;
    button.click();
    queueMicrotask(() => {
      if (bypassButtonRef.current === button) {
        bypassButtonRef.current = null;
      }
    });
  };

  return (
    <GameModal
      eyebrow={copy.eyebrow}
      title={copy.title}
      onClose={() => setPending(null)}
      className="game-action-modal w-full max-w-sm p-6"
    >
      <p className="mt-3 text-sm leading-6 text-[#c8d9d1]">
        {copy.description}
      </p>

      <div className="game-modal-actions mt-6">
        <button
          type="button"
          onClick={confirm}
          className="game-primary-action w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.12em]"
        >
          {copy.confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setPending(null)}
          className="game-cancel-action mt-3 w-full text-xs font-bold uppercase tracking-[0.12em]"
        >
          {copy.cancelLabel}
        </button>
      </div>
    </GameModal>
  );
}

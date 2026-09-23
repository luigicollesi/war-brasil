"use client";

import { GameModal } from "@/src/components/game-modal";

type GameLeaveModalProps = {
  finished: boolean;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GameLeaveModal({
  finished,
  pending,
  error,
  onCancel,
  onConfirm,
}: GameLeaveModalProps) {
  return (
    <GameModal
      eyebrow="SAÍDA DA OPERAÇÃO"
      title="Sair da partida?"
      tone="default"
      onClose={pending ? undefined : onCancel}
      className="w-full max-w-md p-6 text-white sm:p-7"
    >
      <p className="mt-4 text-sm leading-6 text-white/75">
        {finished
          ? "Você deixará esta sala e poderá voltar a navegar pelo Comando. O resultado já registrado não será alterado."
          : "Suas cartas serão descartadas e seus territórios serão redistribuídos entre os jogadores ainda ativos. Esta saída não poderá ser desfeita."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="game-secondary-action h-11 rounded-xl px-4 text-xs font-bold uppercase tracking-[.12em] disabled:opacity-55"
          disabled={pending}
          onClick={onCancel}
        >
          Permanecer
        </button>
        <button
          type="button"
          className="game-primary-action h-11 rounded-xl px-4 text-xs font-bold uppercase tracking-[.12em] disabled:opacity-55"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Saindo…" : "Sair da partida"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[#ffd2c9]" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

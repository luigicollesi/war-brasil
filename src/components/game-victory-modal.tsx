"use client";

import { GameModal } from "@/src/components/game-modal";
import type { GameSnapshot } from "@/src/lib/game-contract";

type GameVictoryModalProps = {
  snapshot: GameSnapshot;
  isVoting: boolean;
  isReturningToLobby: boolean;
  error: string;
  onVoteRematch: () => void;
  onReturnToLobby: () => void;
};

export function GameVictoryModal({
  snapshot,
  isVoting,
  isReturningToLobby,
  error,
  onVoteRematch,
  onReturnToLobby,
}: GameVictoryModalProps) {
  const winner = snapshot.players.find(
    (player) => player.id === snapshot.room.winnerPlayerId,
  );
  const winnerIsMe = Boolean(winner?.isMe);
  const rematch = snapshot.room.rematch;
  const busy = isVoting || isReturningToLobby;

  return (
    <GameModal
      eyebrow="PARTIDA ENCERRADA"
      title={winnerIsMe ? "Você venceu" : `${winner?.factionName ?? "Uma facção"} venceu`}
      tone="event"
      className="victory-modal w-full max-w-lg p-6 text-white sm:p-8"
    >
      <div className="victory-emblem" aria-hidden="true">
        ★
      </div>

      <p className="victory-message">
        {winnerIsMe
          ? "Seu objetivo foi concluído. O tabuleiro está paralisado até o grupo decidir o próximo passo."
          : `${winner?.factionName ?? "O vencedor"} concluiu seu objetivo. O tabuleiro está paralisado.`}
      </p>

      {rematch ? (
        <div className="victory-rematch-status" aria-live="polite">
          <span>Reiniciar partida</span>
          <strong>
            {rematch.voteCount}/{rematch.requiredCount} votos
          </strong>
          <div aria-hidden="true">
            <span
              style={{
                width: `${Math.min(
                  100,
                  rematch.requiredCount > 0
                    ? (rematch.voteCount / rematch.requiredCount) * 100
                    : 0,
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="victory-actions">
        <button
          type="button"
          className="game-primary-action h-12 rounded-xl px-5 text-xs font-bold uppercase tracking-[.12em] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={busy || rematch?.hasVoted}
          onClick={onVoteRematch}
        >
          {rematch?.hasVoted
            ? "Voto registrado"
            : isVoting
              ? "Registrando voto…"
              : "Votar para reiniciar"}
        </button>

        <button
          type="button"
          className="game-secondary-action h-12 rounded-xl px-5 text-xs font-bold uppercase tracking-[.12em] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={busy}
          onClick={onReturnToLobby}
        >
          {isReturningToLobby ? "Voltando ao lobby…" : "Voltar todos ao lobby"}
        </button>
      </div>

      <p className="victory-lobby-note">
        Reiniciar exige o voto de todos. Voltar ao lobby leva imediatamente todos os jogadores para a sala {snapshot.room.code}.
      </p>

      {error ? (
        <p className="victory-error" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

"use client";

import { GameModal } from "@/src/components/game-modal";
import type { GameSnapshot } from "@/src/lib/game-contract";

type GameVictoryModalProps = {
  snapshot: GameSnapshot;
  isVoting: boolean;
  isReturningToLobby: boolean;
  isLeavingGame: boolean;
  error: string;
  onVoteRematch: () => void;
  onReturnToLobby: () => void;
  onLeaveGame: () => void;
};

function winnerSummary(snapshot: GameSnapshot) {
  const winners = snapshot.room.winnerPlayerIds
    .map((id) => snapshot.players.find((player) => player.id === id))
    .filter((player): player is GameSnapshot["players"][number] => Boolean(player));
  const meWon = winners.some((winner) => winner.isMe);
  const otherWinners = winners.filter((winner) => !winner.isMe);

  if (winners.length === 0) {
    return {
      title: "Partida encerrada",
      message: "A partida foi encerrada sem um vencedor registrado.",
    };
  }

  if (winners.length === 1) {
    const winner = winners[0];
    return winner.isMe
      ? {
          title: "Você venceu",
          message:
            "Seu objetivo foi concluído. O tabuleiro está paralisado até o grupo decidir o próximo passo.",
        }
      : {
          title: `${winner.factionName} venceu`,
          message: `${winner.factionName} concluiu seu objetivo. O tabuleiro está paralisado.`,
        };
  }

  if (meWon) {
    const others =
      otherWinners.length === 1
        ? otherWinners[0].factionName
        : `${otherWinners.length} outros jogadores`;
    return {
      title: `Você e ${others} venceram`,
      message:
        "Mais de um objetivo foi concluído no mesmo estado autoritativo do tabuleiro.",
    };
  }

  const names = winners.map((winner) => winner.factionName);
  const label =
    names.length === 2
      ? `${names[0]} e ${names[1]}`
      : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
  return {
    title: `${label} venceram`,
    message:
      "Mais de um objetivo foi concluído no mesmo estado autoritativo do tabuleiro.",
  };
}

export function GameVictoryModal({
  snapshot,
  isVoting,
  isReturningToLobby,
  isLeavingGame,
  error,
  onVoteRematch,
  onReturnToLobby,
  onLeaveGame,
}: GameVictoryModalProps) {
  const summary = winnerSummary(snapshot);
  const rematch = snapshot.room.rematch;
  const busy = isVoting || isReturningToLobby || isLeavingGame;

  return (
    <GameModal
      eyebrow="PARTIDA ENCERRADA"
      title={summary.title}
      tone="event"
      className="victory-modal w-full max-w-lg p-6 text-white sm:p-8"
    >
      <div className="victory-emblem" aria-hidden="true">
        ★
      </div>

      <p className="victory-message">{summary.message}</p>

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

        <button
          type="button"
          className="game-secondary-action h-12 rounded-xl px-5 text-xs font-bold uppercase tracking-[.12em] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={busy}
          onClick={onLeaveGame}
        >
          {isLeavingGame ? "Saindo…" : "Sair da partida"}
        </button>
      </div>

      <p className="victory-lobby-note">
        Reiniciar exige o voto de todos. Voltar ao lobby leva imediatamente os jogadores ainda ativos para a sala {snapshot.room.code}.
      </p>

      {error ? (
        <p className="victory-error" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

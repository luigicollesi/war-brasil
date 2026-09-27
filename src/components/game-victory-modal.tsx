"use client";

import { useEffect, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import type { GameSnapshot } from "@/src/lib/game-contract";
import type { BattlePassMatchResult } from "@/src/lib/shared/progression/battle-pass-presentation";

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
  const [battlePassResult, setBattlePassResult] = useState<
    BattlePassMatchResult | null | undefined
  >(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBattlePassResult(undefined);

    void fetch(`/api/games/${snapshot.room.id}/battle-pass-result`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("battle_pass_result_unavailable");
        const body = (await response.json()) as {
          result?: BattlePassMatchResult | null;
        };
        if (active) setBattlePassResult(body.result ?? null);
      })
      .catch((requestError) => {
        if (
          active &&
          !(requestError instanceof DOMException && requestError.name === "AbortError")
        ) {
          setBattlePassResult(null);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [snapshot.room.id]);

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

      {battlePassResult === undefined ? (
        <div
          className="victory-battle-pass-status"
          data-loading="true"
          aria-live="polite"
        >
          <span>Passe de Campanha</span>
          <strong>Confirmando progresso…</strong>
        </div>
      ) : battlePassResult ? (
        <div className="victory-battle-pass-status" aria-live="polite">
          <div className="victory-battle-pass-heading">
            <span>{battlePassResult.seasonName}</span>
            <strong>+{battlePassResult.xpGranted} XP</strong>
          </div>
          <div className="victory-battle-pass-level">
            {battlePassResult.levelsGained > 0 ? (
              <>
                <span>NÍVEL {battlePassResult.levelBefore}</span>
                <b aria-hidden="true">→</b>
                <strong>NÍVEL {battlePassResult.levelAfter}</strong>
              </>
            ) : (
              <strong>NÍVEL {battlePassResult.levelAfter}</strong>
            )}
          </div>
          <div className="victory-battle-pass-breakdown">
            <span>
              Base +{battlePassResult.breakdown.completionXp}
            </span>
            {battlePassResult.breakdown.victoryBonusXp > 0 ? (
              <span>
                Vitória +{battlePassResult.breakdown.victoryBonusXp}
              </span>
            ) : null}
            {battlePassResult.breakdown.multiplierBps < 10_000 ? (
              <span>
                Ajuste ×
                {(battlePassResult.breakdown.multiplierBps / 10_000)
                  .toFixed(2)
                  .replace(".", ",")}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

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

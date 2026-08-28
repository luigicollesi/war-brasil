"use client";

import { useState } from "react";
import { GameDie } from "@/src/components/game-die";
import { GameModal } from "@/src/components/game-modal";
import { barrierAttackSummary } from "@/src/lib/game-barrier-presentation";
import { attackerLossPerComparison } from "@/src/lib/game-barrier-rules";
import {
  battleAttackMode,
  battleComparisonRows,
} from "@/src/lib/game-battle-presentation";
import { runGameCommand } from "@/src/lib/game-command-client";
import type { GameSnapshot } from "@/src/lib/game-contract";

export function BattleOverlay({
  roomId,
  battle,
  players,
  meId,
  onRefresh,
}: {
  roomId: string;
  battle: NonNullable<GameSnapshot["room"]["battle"]>;
  players: GameSnapshot["players"];
  meId: string | undefined;
  onRefresh: (minimumRevision?: number) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [rolling, setRolling] = useState(false);
  const attacker = players.find((player) => player.id === battle.attackerPlayerId);
  const defender = players.find((player) => player.id === battle.defenderPlayerId);
  const attackMode = battleAttackMode(battle);
  const isBarrierAttack = attackMode === "barrier";
  const comparisonRows = battleComparisonRows(battle);
  const lossPerComparison = attackerLossPerComparison(attackMode);
  const barrierSummary = isBarrierAttack
    ? barrierAttackSummary({
        barrierName: battle.barrierName,
        selectable: true,
        minimumTroops: 4,
        lossPerComparison,
      })
    : null;
  const canRoll =
    (battle.stage === "awaiting_attacker_roll" &&
      meId === battle.attackerPlayerId) ||
    (battle.stage === "awaiting_defender_roll" &&
      meId === battle.defenderPlayerId);
  const label =
    battle.stage === "awaiting_attacker_roll"
      ? "Aguardando o atacante"
      : battle.stage === "show_attacker_result"
        ? "Resultado do ataque"
        : battle.stage === "awaiting_defender_roll"
          ? "Aguardando a defesa"
          : battle.stage === "show_defender_result"
            ? "Resultado da defesa"
            : battle.stage === "show_comparison"
              ? "Confronto"
              : battle.conquered
                ? "Território conquistado"
                : "Resultado da batalha";

  async function roll() {
    setError("");
    setRolling(true);
    try {
      const result = await runGameCommand(
        roomId,
        "attack/roll",
        undefined,
        "Não foi possível rolar os dados.",
      );
      await onRefresh(result.revision ?? undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível rolar os dados.",
      );
    } finally {
      window.setTimeout(() => setRolling(false), 850);
    }
  }

  return (
    <GameModal
      eyebrow={isBarrierAttack ? "COMBATE · BARREIRA" : "COMBATE"}
      title={label}
      tone={isBarrierAttack ? "barrier" : "default"}
      className="battle-modal w-full max-w-xl p-6 text-white"
    >
      <p className="battle-matchup">
        {attacker?.factionName ?? "Atacante"}
        <span aria-hidden="true">×</span>
        {defender?.factionName ?? "Defensor"}
      </p>

      {barrierSummary ? (
        <div className="battle-barrier-summary" role="note">
          <strong>▣ {barrierSummary.name}</strong>
          <span>{barrierSummary.detail}</span>
        </div>
      ) : null}

      <div className="battle-dice-grid">
        {battle.attacker.length ? (
          <div className="battle-side battle-side--attack">
            <p>Ataque</p>
            <div>
              {battle.attacker.map((value, index) => (
                <GameDie
                  key={`${value}-${index}-${battle.stage}`}
                  value={value}
                  color={attacker?.color ?? "forest"}
                  rolling={rolling || battle.stage === "show_attacker_result"}
                />
              ))}
            </div>
          </div>
        ) : null}

        {battle.defender.length ? (
          <div className="battle-side battle-side--defense">
            <p>Defesa</p>
            <div>
              {battle.defender.map((value, index) => (
                <GameDie
                  key={`${value}-${index}-${battle.stage}`}
                  value={value}
                  color={defender?.color ?? "ruby"}
                  rolling={rolling || battle.stage === "show_defender_result"}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {battle.stage === "show_comparison" ||
      battle.stage === "show_battle_result" ? (
        <div className="battle-comparisons" aria-live="polite">
          {comparisonRows.map((row, index) => (
            <div key={index}>
              <span>{row.attackerDie}</span>
              <small>×</small>
              <span>{row.defenderDie}</span>
              <strong>
                {row.loser === "defender"
                  ? "Defesa −1"
                  : `Ataque −${row.troopLoss}`}
              </strong>
            </div>
          ))}
        </div>
      ) : null}

      {battle.stage === "show_battle_result" ? (
        <div className="battle-result" aria-live="polite">
          <span>
            Atacante <strong>−{battle.attackerLosses}</strong>
          </span>
          <span>
            Defensor <strong>−{battle.defenderLosses}</strong>
          </span>
          {battle.conquered ? <em>Conquista confirmada</em> : null}
        </div>
      ) : null}

      {canRoll ? (
        <button
          type="button"
          onClick={() => void roll()}
          disabled={rolling}
          className="game-primary-action mt-6 h-12 w-full rounded-xl text-xs font-bold uppercase tracking-[.14em] disabled:opacity-50"
        >
          {rolling ? "Rolando…" : "Rolar dados"}
        </button>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[#ffd2c9]" role="alert">
          {error}
        </p>
      ) : null}
    </GameModal>
  );
}

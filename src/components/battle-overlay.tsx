"use client";

import { useCallback, useEffect, useState } from "react";
import { BattleStaticDiceResults } from "@/src/components/battle-static-dice-results";
import {
  BATTLE_DICE_CINEMATIC_TOTAL_MS,
  BattleDiceCinematic,
  type BattleDiceCinematicSide,
} from "@/src/components/dice-3d/battle-dice-cinematic";
import { GameModal } from "@/src/components/game-modal";
import { barrierAttackSummary } from "@/src/lib/game-barrier-presentation";
import { attackerLossPerComparison } from "@/src/lib/game-barrier-rules";
import {
  battleAttackMode,
  battleComparisonRows,
} from "@/src/lib/game-battle-presentation";
import { runGameCommand } from "@/src/lib/game-command-client";
import type { GameSnapshot } from "@/src/lib/game-contract";

type BattleParticipantProps = {
  side: "attack" | "defense";
  playerName: string;
  territoryName: string;
  troops: number | undefined;
};

type RollingSide = "attack" | "defense";

type CinematicPresentation = {
  id: string;
  side: BattleDiceCinematicSide;
  elapsedMs: number;
};

function fallbackTerritoryName(territoryId: number) {
  return `Território ${territoryId}`;
}

function readTerritoryNameFromBoard(territoryId: number) {
  if (typeof document === "undefined") {
    return fallbackTerritoryName(territoryId);
  }

  try {
    const boardObject = document.querySelector<HTMLObjectElement>(
      ".game-map-object",
    );
    const path = boardObject?.contentDocument?.querySelector<SVGPathElement>(
      `path.territory[data-id="${territoryId}"]`,
    );
    return path?.dataset.name?.trim() || fallbackTerritoryName(territoryId);
  } catch {
    return fallbackTerritoryName(territoryId);
  }
}

function battleCinematicSide(
  battle: NonNullable<GameSnapshot["room"]["battle"]>,
): BattleDiceCinematicSide | null {
  if (battle.stage === "show_attacker_result") return "attack";
  if (battle.stage === "show_defender_result") return "defense";
  return null;
}

function battleCinematicPresentationId(
  battle: NonNullable<GameSnapshot["room"]["battle"]>,
  side: BattleDiceCinematicSide,
) {
  const values = side === "attack" ? battle.attacker : battle.defender;
  return [
    battle.attackerPlayerId,
    battle.attackerTerritoryId,
    battle.defenderPlayerId,
    battle.defenderTerritoryId,
    side,
    battle.stageStartedAt,
    values.join("-"),
  ].join(":");
}

function BattleParticipant({
  side,
  playerName,
  territoryName,
  troops,
}: BattleParticipantProps) {
  return (
    <div className={`battle-participant battle-participant--${side}`}>
      <p className="battle-player-name">{playerName}</p>
      <strong className="battle-territory-name">{territoryName}</strong>
      <p className="battle-troop-count">
        <strong>{troops ?? "—"}</strong>
        <span>{troops === 1 ? "tropa" : "tropas"}</span>
      </p>
    </div>
  );
}

export function BattleOverlay({
  roomId,
  battle,
  players,
  territories,
  meId,
  onRefresh,
}: {
  roomId: string;
  battle: NonNullable<GameSnapshot["room"]["battle"]>;
  players: GameSnapshot["players"];
  territories: GameSnapshot["territories"];
  meId: string | undefined;
  onRefresh: (minimumRevision?: number) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [rollingSide, setRollingSide] = useState<RollingSide | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [completedPresentationId, setCompletedPresentationId] = useState<string | null>(
    null,
  );
  const [cinematicPresentation, setCinematicPresentation] =
    useState<CinematicPresentation | null>(null);
  const [territoryNames, setTerritoryNames] = useState(() => ({
    attacker: fallbackTerritoryName(battle.attackerTerritoryId),
    defender: fallbackTerritoryName(battle.defenderTerritoryId),
  }));
  const attacker = players.find((player) => player.id === battle.attackerPlayerId);
  const defender = players.find((player) => player.id === battle.defenderPlayerId);
  const attackerTerritory = territories.find(
    (territory) => territory.territoryId === battle.attackerTerritoryId,
  );
  const defenderTerritory = territories.find(
    (territory) => territory.territoryId === battle.defenderTerritoryId,
  );
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
  const canCancelAttack =
    battle.stage === "awaiting_attacker_roll" &&
    meId === battle.attackerPlayerId &&
    battle.attacker.length === 0 &&
    battle.defender.length === 0;
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

  useEffect(() => {
    const boardObject = document.querySelector<HTMLObjectElement>(
      ".game-map-object",
    );

    const syncTerritoryNames = () => {
      setTerritoryNames({
        attacker: readTerritoryNameFromBoard(battle.attackerTerritoryId),
        defender: readTerritoryNameFromBoard(battle.defenderTerritoryId),
      });
    };

    syncTerritoryNames();
    boardObject?.addEventListener("load", syncTerritoryNames);
    return () => {
      boardObject?.removeEventListener("load", syncTerritoryNames);
    };
  }, [battle.attackerTerritoryId, battle.defenderTerritoryId]);

  useEffect(() => {
    const side = battleCinematicSide(battle);
    if (!side) {
      setCinematicPresentation(null);
      return;
    }

    const id = battleCinematicPresentationId(battle, side);
    if (completedPresentationId === id) {
      setCinematicPresentation(null);
      return;
    }

    const startedAtMs = Date.parse(battle.stageStartedAt);
    const elapsedMs = Number.isFinite(startedAtMs)
      ? Math.max(0, Date.now() - startedAtMs)
      : BATTLE_DICE_CINEMATIC_TOTAL_MS;

    if (elapsedMs >= BATTLE_DICE_CINEMATIC_TOTAL_MS) {
      setCompletedPresentationId(id);
      setCinematicPresentation(null);
      return;
    }

    setCinematicPresentation({ id, side, elapsedMs });
    const timeoutId = window.setTimeout(() => {
      setCompletedPresentationId(id);
      setCinematicPresentation((current) =>
        current?.id === id ? null : current,
      );
    }, BATTLE_DICE_CINEMATIC_TOTAL_MS - elapsedMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    battle,
    battle.stage,
    battle.stageStartedAt,
    completedPresentationId,
  ]);

  useEffect(() => {
    if (!cinematicPresentation) return;

    const gameRoot = document.querySelector<HTMLElement>(".game-runtime > div");
    if (!gameRoot) return;

    const alreadyInert = gameRoot.hasAttribute("inert");
    if (!alreadyInert) gameRoot.setAttribute("inert", "");

    return () => {
      if (!alreadyInert) gameRoot.removeAttribute("inert");
    };
  }, [cinematicPresentation]);

  const finishCinematic = useCallback((id: string) => {
    setCompletedPresentationId(id);
    setCinematicPresentation((current) =>
      current?.id === id ? null : current,
    );
  }, []);

  async function roll() {
    if (cancelling) return;
    const side: RollingSide =
      battle.stage === "awaiting_defender_roll" ? "defense" : "attack";
    setError("");
    setRollingSide(side);
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
      window.setTimeout(() => setRollingSide(null), 950);
    }
  }

  async function cancelAttack() {
    if (!canCancelAttack || cancelling || rollingSide !== null) return;
    setError("");
    setCancelling(true);
    try {
      const result = await runGameCommand(
        roomId,
        "attack/cancel",
        undefined,
        "Não foi possível cancelar o ataque.",
      );
      await onRefresh(result.revision ?? undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível cancelar o ataque.",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (cinematicPresentation) {
    const cinematicColor =
      cinematicPresentation.side === "attack"
        ? (attacker?.color ?? "forest")
        : (defender?.color ?? "ruby");

    return (
      <BattleDiceCinematic
        battle={battle}
        side={cinematicPresentation.side}
        color={cinematicColor}
        elapsedMs={cinematicPresentation.elapsedMs}
        onComplete={() => finishCinematic(cinematicPresentation.id)}
      />
    );
  }

  return (
    <GameModal
      eyebrow={isBarrierAttack ? "COMBATE · BARREIRA" : "COMBATE"}
      title={label}
      tone={isBarrierAttack ? "barrier" : "default"}
      className="battle-modal w-full max-w-xl p-4 text-white sm:p-6"
    >
      <div className="battle-context" aria-label="Territórios em combate">
        <BattleParticipant
          side="attack"
          playerName={attacker?.factionName ?? "Atacante"}
          territoryName={territoryNames.attacker}
          troops={attackerTerritory?.troops}
        />
        <span className="battle-context-arrow" aria-hidden="true">
          →
        </span>
        <BattleParticipant
          side="defense"
          playerName={defender?.factionName ?? "Defensor"}
          territoryName={territoryNames.defender}
          troops={defenderTerritory?.troops}
        />
      </div>

      {barrierSummary ? (
        <div className="battle-barrier-summary" role="note">
          <strong>▣ {barrierSummary.name}</strong>
          <span>{barrierSummary.detail}</span>
        </div>
      ) : null}

      <BattleStaticDiceResults
        battle={battle}
        attackerColor={attacker?.color ?? "forest"}
        defenderColor={defender?.color ?? "ruby"}
      />

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
          disabled={rollingSide !== null || cancelling}
          className="game-primary-action mt-6 h-12 w-full rounded-xl text-xs font-bold uppercase tracking-[.14em] disabled:opacity-50"
        >
          {rollingSide ? "Rolando…" : "Rolar dados"}
        </button>
      ) : null}

      {canCancelAttack ? (
        <button
          type="button"
          onClick={() => void cancelAttack()}
          disabled={rollingSide !== null || cancelling}
          className="mx-auto mt-2 block rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#d8c9b2] transition hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          {cancelling ? "Cancelando…" : "Cancelar ataque"}
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

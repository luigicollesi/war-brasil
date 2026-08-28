"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  BARRIER_ATTACK_DICE_BANDS,
  attackerLossPerComparison,
} from "@/src/lib/game-barrier-rules";
import {
  attackerComparisonLossCount,
  battleAttackMode,
  battleComparisonRows,
} from "@/src/lib/game-battle-presentation";
import { runGameCommand } from "@/src/lib/game-command-client";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const pipPositions: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

function colorHex(color: PlayerColor) {
  return PLAYER_COLORS.find((item) => item.value === color)?.hex ?? "#17372d";
}

function BattleDie({
  value,
  color,
  isRolling,
}: {
  value: number;
  color: PlayerColor;
  isRolling: boolean;
}) {
  return (
    <div
      className={
        "relative aspect-square w-32 overflow-hidden rounded-3xl " +
        (isRolling ? "dice-roll-animation" : "")
      }
      aria-label={`Dado mostrando ${value}`}
    >
      <Image
        src="/dado-brasil-hq.svg"
        alt=""
        fill
        sizes="128px"
        className="object-cover"
      />
      {pipPositions[value].map(([x, y], index) => (
        <span
          key={index}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 shadow-md"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            backgroundColor: colorHex(color),
          }}
        />
      ))}
    </div>
  );
}

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
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const attacker = players.find((player) => player.id === battle.attackerPlayerId);
  const defender = players.find((player) => player.id === battle.defenderPlayerId);
  const attackMode = battleAttackMode(battle);
  const isBarrierAttack = attackMode === "barrier";
  const comparisonRows = battleComparisonRows(battle);
  const attackerComparisonLosses = attackerComparisonLossCount(comparisonRows);
  const lossPerComparison = attackerLossPerComparison(attackMode);
  const canRoll =
    (battle.stage === "awaiting_attacker_roll" && meId === battle.attackerPlayerId) ||
    (battle.stage === "awaiting_defender_roll" && meId === battle.defenderPlayerId);
  const label =
    battle.stage === "awaiting_attacker_roll"
      ? "Aguardando o atacante..."
      : battle.stage === "show_attacker_result"
        ? "Resultado do atacante"
        : battle.stage === "awaiting_defender_roll"
          ? "Aguardando o defensor..."
          : battle.stage === "show_defender_result"
            ? "Resultado do defensor"
            : battle.stage === "show_comparison"
              ? "Comparando os dados"
              : battle.conquered
                ? "Território conquistado"
                : "Resultado da batalha";

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

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
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-[#14241f]/35 p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pointer-events-auto w-full max-w-xl rounded-3xl bg-[#12392f] p-6 text-white shadow-2xl"
      >
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9eb8ae]">
          Combate sincronizado
        </p>
        <h2 id={titleId} className="mt-2 text-2xl font-semibold" aria-live="polite">
          {label}
        </h2>
        <p className="mt-1 text-sm text-[#c8d9d1]">
          {attacker?.factionName ?? "Atacante"} × {defender?.factionName ?? "Defensor"}
        </p>

        {isBarrierAttack ? (
          <div
            className="battle-barrier-warning mt-5 rounded-2xl bg-[#5a1f1a]/35 p-4 ring-1 ring-[#ff9d7a]/20"
            role="note"
          >
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#ffb59d]">
              ☠ Ataque através de barreira
            </p>
            <p className="mt-1 font-semibold text-[#fff0df]">
              {battle.barrierName ?? "Barreira natural"}
            </p>
            <p className="mt-2 text-sm text-[#ffd8ca]">
              Cada comparação perdida pelo atacante elimina {lossPerComparison} tropas.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#e8d8cc]">
              {BARRIER_ATTACK_DICE_BANDS.map((band) => (
                <span
                  key={band.minimumTroops}
                  className="battle-barrier-band rounded-full bg-white/8 px-2.5 py-1"
                >
                  {band.maximumTroops === null
                    ? `${band.minimumTroops}+`
                    : `${band.minimumTroops}–${band.maximumTroops}`} tropas → {band.diceCount} {band.diceCount === 1 ? "dado" : "dados"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-center gap-8">
          {battle.attacker.length ? (
            <div className="text-center">
              <p className="mb-2 text-xs text-[#b9ccc4]">Ataque</p>
              <div className="flex justify-center gap-2">
                {battle.attacker.map((value, index) => (
                  <BattleDie
                    key={`${value}-${index}-${battle.stage}`}
                    value={value}
                    color={attacker?.color ?? "forest"}
                    isRolling={rolling || battle.stage === "show_attacker_result"}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {battle.defender.length ? (
            <div className="text-center">
              <p className="mb-2 text-xs text-[#b9ccc4]">Defesa</p>
              <div className="flex justify-center gap-2">
                {battle.defender.map((value, index) => (
                  <BattleDie
                    key={`${value}-${index}-${battle.stage}`}
                    value={value}
                    color={defender?.color ?? "ruby"}
                    isRolling={rolling || battle.stage === "show_defender_result"}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {battle.stage === "show_comparison" || battle.stage === "show_battle_result" ? (
          <div className="mt-6 space-y-1 rounded-2xl bg-white/8 p-4 text-sm" aria-live="polite">
            {comparisonRows.map((row, index) => (
              <p key={index}>
                Ataque {row.attackerDie} × Defesa {row.defenderDie} →{" "}
                {row.loser === "defender"
                  ? "defesa perde 1"
                  : `ataque perde ${row.troopLoss}`}
              </p>
            ))}
          </div>
        ) : null}

        {battle.stage === "show_battle_result" ? (
          <div className="mt-5 text-sm font-semibold text-[#e8c35e]" aria-live="polite">
            <p>
              Perdas: atacante {battle.attackerLosses} · defesa {battle.defenderLosses}
              {battle.conquered ? " · conquista aguardando transferência" : ""}
            </p>
            {isBarrierAttack && attackerComparisonLosses > 0 ? (
              <p className="mt-1 text-xs font-medium text-[#ffd8ca]">
                {attackerComparisonLosses} {attackerComparisonLosses === 1 ? "comparação perdida" : "comparações perdidas"} × {lossPerComparison} tropas.
              </p>
            ) : null}
          </div>
        ) : null}

        {canRoll ? (
          <button
            type="button"
            onClick={() => void roll()}
            disabled={rolling}
            className="mt-6 h-12 w-full rounded-xl bg-[#e4b94f] text-xs font-bold uppercase tracking-[.14em] text-[#12392f] disabled:opacity-50"
          >
            {rolling ? "Rolando…" : "Rolar dados"}
          </button>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-[#ffd2c9]" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

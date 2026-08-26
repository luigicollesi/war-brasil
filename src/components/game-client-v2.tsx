"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  InteractiveBoard,
  type BoardTerritory,
} from "@/src/components/interactive-board";
import { GameTurnPanel } from "@/src/components/game-turn-panel";
import { useGameInteraction } from "@/src/hooks/use-game-interaction";
import { useGameSync } from "@/src/hooks/use-game-sync";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { runGameCommand } from "@/src/lib/game-command-client";
import { buildGameViewModel } from "@/src/lib/game-view-model";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";

type GameClientProps = {
  roomId: string;
};

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

export function GameClient({ roomId }: GameClientProps) {
  const { snapshot, error, isLoading, refresh } = useGameSync(roomId);
  const [rollError, setRollError] = useState("");
  const [isRolling, setIsRolling] = useState(false);

  if (isLoading && !snapshot) {
    return (
      <div className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-8 text-sm text-[#64756f]">
        Carregando a partida…
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-3xl border border-[#a33c33]/20 bg-[#fff8f5] p-8 text-sm text-[#a33c33]">
        {error || "Não foi possível carregar esta partida."}
      </div>
    );
  }

  return (
    <GameReadyClient
      roomId={roomId}
      snapshot={snapshot}
      error={error}
      refresh={refresh}
      rollError={rollError}
      setRollError={setRollError}
      isRolling={isRolling}
      setIsRolling={setIsRolling}
    />
  );
}

function GameReadyClient({
  roomId,
  snapshot,
  error,
  refresh,
  rollError,
  setRollError,
  isRolling,
  setIsRolling,
}: {
  roomId: string;
  snapshot: GameSnapshot;
  error: string;
  refresh: (minimumRevision?: number) => Promise<void>;
  rollError: string;
  setRollError: (value: string) => void;
  isRolling: boolean;
  setIsRolling: (value: boolean) => void;
}) {
  const game = useMemo(() => buildGameViewModel(snapshot), [snapshot]);
  const interaction = useGameInteraction({ roomId, snapshot, game, refresh });
  const boardTerritories = useMemo<BoardTerritory[]>(
    () =>
      snapshot.territories.flatMap((territory) => {
        const owner = game.playersById.get(territory.ownerPlayerId);
        return owner
          ? [
              {
                territoryId: territory.territoryId,
                ownerPlayerId: territory.ownerPlayerId,
                ownerName: owner.factionName,
                ownerColor: territory.ownerColor,
                troops: territory.troops,
              },
            ]
          : [];
      }),
    [game.playersById, snapshot.territories],
  );
  const me = game.me;
  const currentRound = snapshot.room.orderRollRound;
  const myCurrentRoll = me?.rolls.find((roll) => roll.round === currentRound);
  const canRoll = Boolean(
    snapshot.room.status === "order_roll" &&
      me &&
      snapshot.room.orderRollPlayerId === me.id &&
      !myCurrentRoll,
  );
  const battleArrow = snapshot.room.battle
    ? {
        fromTerritoryId: snapshot.room.battle.attackerTerritoryId,
        toTerritoryId: snapshot.room.battle.defenderTerritoryId,
        kind: "attack" as const,
      }
    : null;

  async function rollDie() {
    setRollError("");
    setIsRolling(true);

    try {
      const result = await runGameCommand(
        roomId,
        "roll",
        undefined,
        "Não foi possível rolar o dado.",
      );
      await refresh(result.revision ?? undefined);
    } catch (requestError) {
      setRollError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível rolar o dado.",
      );
    } finally {
      window.setTimeout(() => setIsRolling(false), 850);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-5 shadow-[0_18px_50px_rgba(42,55,50,0.07)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7a27]">
              {snapshot.room.status === "order_roll"
                ? "Sorteio de ordem · rodada " + currentRound
                : "Ordem de jogo definida"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
              Sala {snapshot.room.code}
            </h1>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e3eee6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#326347]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#3f8b68]" />
            Sincronizado
          </span>
        </div>
      </section>

      {snapshot.room.status !== "order_roll" ? (
        <TurnOrderStrip
          players={snapshot.players}
          currentPlayerId={snapshot.room.currentPlayerId}
        />
      ) : null}

      {snapshot.room.status === "order_roll" ? (
        <OrderRollPanel
          players={snapshot.players}
          eligiblePlayerIds={snapshot.eligiblePlayerIds}
          currentRound={currentRound}
          meId={me?.id}
          orderRollPlayerId={snapshot.room.orderRollPlayerId}
          lastOrderRollPlayerId={snapshot.room.lastOrderRollPlayerId}
          canRoll={canRoll}
          isRolling={isRolling}
          currentColor={me?.color}
          onRoll={rollDie}
          error={rollError}
        />
      ) : snapshot.room.status === "finished" ? (
        <FinalOrder players={snapshot.players} />
      ) : null}

      <InteractiveBoard
        territories={boardTerritories}
        connections={snapshot.connections}
        onSelect={interaction.onTerritoryClick}
        selectedTerritoryId={interaction.selectedTerritoryId}
        availableTerritoryIds={interaction.mapHints.available}
        targetTerritoryIds={interaction.mapHints.targets}
        arrow={battleArrow ?? interaction.arrow}
      />

      <GameTurnPanel
        roomId={roomId}
        snapshot={snapshot}
        game={game}
        interaction={interaction}
        onRefresh={refresh}
      />

      {snapshot.room.battle ? (
        <BattleOverlay
          roomId={roomId}
          battle={snapshot.room.battle}
          players={snapshot.players}
          meId={me?.id}
          onRefresh={refresh}
        />
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[#fff0eb] px-4 py-3 text-sm text-[#a33c33]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type OrderRollPanelProps = {
  players: Array<{
    id: string;
    factionName: string;
    color: PlayerColor;
    isMe: boolean;
    rolls: Array<{ round: number; value: number }>;
  }>;
  eligiblePlayerIds: string[];
  currentRound: number;
  meId: string | undefined;
  orderRollPlayerId: string | null;
  lastOrderRollPlayerId: string | null;
  canRoll: boolean;
  isRolling: boolean;
  currentColor: PlayerColor | undefined;
  onRoll: () => void;
  error: string;
};

function OrderRollPanel({
  players,
  eligiblePlayerIds,
  currentRound,
  meId,
  orderRollPlayerId,
  lastOrderRollPlayerId,
  canRoll,
  isRolling,
  currentColor,
  onRoll,
  error,
}: OrderRollPanelProps) {
  const shownPlayer =
    players.find((player) => player.id === lastOrderRollPlayerId) ??
    players.find((player) => player.id === orderRollPlayerId);
  const shownValue =
    shownPlayer?.rolls.find((roll) => roll.round === currentRound)?.value ?? 1;

  return (
    <section className="grid gap-5 rounded-3xl bg-[#12392f] p-5 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)] lg:grid-cols-[14rem_1fr] sm:p-7">
      <div className="flex flex-col items-center justify-center">
        <BrazilDie
          key={`${currentRound}-${shownPlayer?.id ?? "pending"}-${shownValue}`}
          value={shownValue}
          color={shownPlayer?.color ?? currentColor ?? "forest"}
          isRolling={
            isRolling ||
            Boolean(
              shownPlayer?.rolls.find((roll) => roll.round === currentRound),
            )
          }
        />
        <button
          type="button"
          onClick={onRoll}
          disabled={!canRoll || isRolling}
          className="mt-5 h-12 w-full rounded-xl bg-[#e4b94f] px-5 text-xs font-bold uppercase tracking-[0.14em] text-[#12392f] transition hover:bg-[#f1ca68] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isRolling
            ? "Rolando…"
            : canRoll
              ? "Rolar dado"
              : orderRollPlayerId === null
                ? "Resultado confirmado"
                : "Aguardando jogador"}
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9eb8ae]">
          Resultado compartilhado
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          {orderRollPlayerId === null
            ? "Resultado da rodada."
            : orderRollPlayerId === meId
              ? "Sua vez de rolar o dado."
              : "Aguardando o jogador da vez."}
        </h2>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {players.map((player) => {
            const currentRoll = player.rolls.find(
              (roll) => roll.round === currentRound,
            );
            const needsRoll = eligiblePlayerIds.includes(player.id);
            return (
              <li
                key={player.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 p-3"
              >
                <span
                  className="h-8 w-8 rounded-lg ring-2 ring-white/15"
                  style={{ backgroundColor: colorHex(player.color) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {player.factionName}
                  </p>
                  <p className="text-xs text-[#b9ccc4]">
                    {currentRoll
                      ? `Dado: ${currentRoll.value}`
                      : player.id === orderRollPlayerId
                        ? "Aguardando dado"
                        : needsRoll
                          ? "Aguardando sua vez"
                          : "Ordem já definida"}
                  </p>
                </div>
                {player.isMe ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8c35e]">
                    Você
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {error ? <p className="mt-4 text-sm text-[#ffd2c9]">{error}</p> : null}
      </div>
    </section>
  );
}

function BrazilDie({
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
        priority
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

function FinalOrder({ players }: { players: GameSnapshot["players"] }) {
  return (
    <section className="rounded-3xl bg-[#12392f] p-6 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9eb8ae]">
        Ordem de jogo
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-3 rounded-2xl bg-white/7 p-4"
          >
            <span className="text-2xl font-semibold text-[#e8c35e]">
              {player.turnPosition}º
            </span>
            <span
              className="h-8 w-8 rounded-lg ring-2 ring-white/15"
              style={{ backgroundColor: colorHex(player.color) }}
            />
            <span className="min-w-0 truncate text-sm font-semibold">
              {player.factionName}
              {player.isMe ? " · você" : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TurnOrderStrip({
  players,
  currentPlayerId,
}: {
  players: GameSnapshot["players"];
  currentPlayerId: string | null;
}) {
  return (
    <section className="rounded-2xl border border-[#17372d]/10 bg-[#faf8f2] p-3 shadow-sm">
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b7a27]">
        Ordem de jogo
      </p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {players.map((player) => {
          const active = player.id === currentPlayerId;
          return (
            <li
              key={player.id}
              className={
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition " +
                (active
                  ? "bg-[#12392f] font-semibold text-white shadow-md ring-2 ring-[#e4b94f]/70"
                  : "bg-[#e9e4d7] text-[#52635d]")
              }
            >
              <span className="text-xs font-bold">{player.turnPosition}º</span>
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorHex(player.color) }}
              />
              <span className="min-w-0 flex-1 truncate">
                {player.factionName}
                {player.isMe ? " · você" : ""}
              </span>
              {active ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8c35e]">
                  Vez atual
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BattleOverlay({
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

  const pairs = Array.from(
    { length: Math.min(battle.attacker.length, battle.defender.length) },
    (_, index) => ({
      attack: battle.attacker[index],
      defense: battle.defender[index],
    }),
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-[#14241f]/35 p-4">
      <section className="pointer-events-auto w-full max-w-xl rounded-3xl bg-[#12392f] p-6 text-white shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9eb8ae]">
          Combate sincronizado
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{label}</h2>
        <p className="mt-1 text-sm text-[#c8d9d1]">
          {attacker?.factionName ?? "Atacante"} × {defender?.factionName ?? "Defensor"}
        </p>
        <div className="mt-6 flex justify-center gap-8">
          {battle.attacker.length ? (
            <div className="text-center">
              <p className="mb-2 text-xs text-[#b9ccc4]">Ataque</p>
              <div className="flex justify-center gap-2">
                {battle.attacker.map((value, index) => (
                  <BrazilDie
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
                  <BrazilDie
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
          <div className="mt-6 space-y-1 rounded-2xl bg-white/8 p-4 text-sm">
            {pairs.map((pair, index) => (
              <p key={index}>
                Ataque {pair.attack} × Defesa {pair.defense} →{" "}
                {pair.attack > pair.defense ? "defesa perde 1" : "ataque perde 1"}
              </p>
            ))}
          </div>
        ) : null}
        {battle.stage === "show_battle_result" ? (
          <p className="mt-5 text-sm font-semibold text-[#e8c35e]">
            Perdas: atacante {battle.attackerLosses} · defesa {battle.defenderLosses}
            {battle.conquered ? " · conquista aguardando transferência" : ""}
          </p>
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
        {error ? <p className="mt-3 text-sm text-[#ffd2c9]">{error}</p> : null}
      </section>
    </div>
  );
}

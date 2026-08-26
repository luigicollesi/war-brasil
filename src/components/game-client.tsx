"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  InteractiveBoard,
  type BoardTerritory,
} from "@/src/components/interactive-board";
import { useGameSync } from "@/src/hooks/use-game-sync";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";
import { TerritoryCard } from "@/src/components/territory-card";
import type { GameSnapshot } from "@/src/lib/game";
import { isValidTrade } from "@/src/lib/game-rules";
import { findTerritoryConnection, type TerritoryConnection } from "@/src/lib/territory-connections";

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
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number | null>(null);
  const [mapHints, setMapHints] = useState({ available: [] as number[], targets: [] as number[] });
  const [interactionArrow, setInteractionArrow] = useState<{ fromTerritoryId: number; toTerritoryId: number; kind: "movement" } | null>(null);
  const selectTerritory = useCallback(
    (territoryId: number) => setSelectedTerritoryId(current => current === territoryId ? null : territoryId),
    [],
  );

  async function rollDie() {
    setRollError("");
    setIsRolling(true);

    try {
      const response = await fetch(
        "/api/games/" + encodeURIComponent(roomId) + "/roll",
        { method: "POST", cache: "no-store" },
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Não foi possível rolar o dado.";
        throw new Error(message);
      }
      await refresh();
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

  const me = snapshot.players.find((player) => player.isMe);
  const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
  const boardTerritories: BoardTerritory[] = snapshot.territories.flatMap((territory) => {
    const owner = playersById.get(territory.ownerPlayerId);
    return owner
      ? [{
          territoryId: territory.territoryId,
          ownerPlayerId: territory.ownerPlayerId,
          ownerName: owner.factionName,
          ownerColor: territory.ownerColor,
          troops: territory.troops,
        }]
      : [];
  });
  const currentRound = snapshot.room.orderRollRound;
  const myCurrentRoll = me?.rolls.find((roll) => roll.round === currentRound);
  const canRoll = Boolean(
    snapshot.room.status === "order_roll" &&
      me && snapshot.room.orderRollPlayerId === me.id &&
      !myCurrentRoll,
  );
  const battleArrow = snapshot.room.battle ? { fromTerritoryId: snapshot.room.battle.attackerTerritoryId, toTerritoryId: snapshot.room.battle.defenderTerritoryId, kind: "attack" as const } : null;

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
        onSelect={selectTerritory}
        selectedTerritoryId={selectedTerritoryId}
        availableTerritoryIds={mapHints.available}
        targetTerritoryIds={mapHints.targets}
        arrow={battleArrow ?? interactionArrow}
      />

      <GameTurnPanel
        roomId={roomId}
        snapshot={snapshot}
        selectedTerritoryId={selectedTerritoryId}
        onRefresh={refresh}
        onMapHints={setMapHints}
        onMapArrow={setInteractionArrow}
      />

      {snapshot.room.battle ? <BattleOverlay roomId={roomId} battle={snapshot.room.battle} players={snapshot.players} meId={me?.id} onRefresh={refresh} /> : null}

      {error ? (
        <p className="rounded-xl bg-[#fff0eb] px-4 py-3 text-sm text-[#a33c33]">{error}</p>
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
  const shownPlayer = players.find(player => player.id === lastOrderRollPlayerId) ?? players.find(player => player.id === orderRollPlayerId);
  const shownValue = shownPlayer?.rolls.find(roll => roll.round === currentRound)?.value ?? 1;
  return (
    <section className="grid gap-5 rounded-3xl bg-[#12392f] p-5 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)] lg:grid-cols-[14rem_1fr] sm:p-7">
      <div className="flex flex-col items-center justify-center">
        <BrazilDie
          key={String(currentRound) + "-" + String(shownPlayer?.id ?? "pending") + "-" + String(shownValue)}
          value={shownValue}
          color={shownPlayer?.color ?? currentColor ?? "forest"}
          isRolling={isRolling || Boolean(shownPlayer?.rolls.find(roll => roll.round === currentRound))}
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
            const currentRoll = player.rolls.find((roll) => roll.round === currentRound);
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
                  <p className="truncate text-sm font-semibold">{player.factionName}</p>
                  <p className="text-xs text-[#b9ccc4]">
                    {currentRoll
                      ? "Dado: " + currentRoll.value
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
      aria-label={"Dado mostrando " + value}
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
            left: x + "%",
            top: y + "%",
            backgroundColor: colorHex(color),
          }}
        />
      ))}
    </div>
  );
}

function FinalOrder({
  players,
}: {
  players: Array<{
    id: string;
    factionName: string;
    color: PlayerColor;
    turnPosition: number | null;
    isMe: boolean;
  }>;
}) {
  return (
    <section className="rounded-3xl bg-[#12392f] p-6 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9eb8ae]">
        Ordem de jogo
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <li key={player.id} className="flex items-center gap-3 rounded-2xl bg-white/7 p-4">
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
  players: Array<{
    id: string;
    factionName: string;
    color: PlayerColor;
    turnPosition: number | null;
    isMe: boolean;
  }>;
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
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorHex(player.color) }} />
              <span className="min-w-0 flex-1 truncate">{player.factionName}{player.isMe ? " · você" : ""}</span>
              {active ? <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8c35e]">Vez atual</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GameTurnPanel({
  roomId,
  snapshot,
  selectedTerritoryId,
  onRefresh,
  onMapHints,
  onMapArrow,
}: {
  roomId: string;
  snapshot: GameSnapshot;
  selectedTerritoryId: number | null;
  onRefresh: () => Promise<void>;
  onMapHints: (hints: { available: number[]; targets: number[] }) => void;
  onMapArrow: (arrow: { fromTerritoryId: number; toTerritoryId: number; kind: "movement" } | null) => void;
}) {
  const [message, setMessage] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState("1");
  const [modal, setModal] = useState<"reinforce" | "maneuver" | "conquest" | "cards" | null>(null);
  const [drawnCard, setDrawnCard] = useState<GameSnapshot["myCards"][number] | null>(null);
  const [barrier, setBarrier] = useState<TerritoryConnection | null>(null);
  const lastSelection = useRef<number | null>(null);
  const previousCards = useRef(new Set<string>());
  const me = snapshot.players.find((player) => player.isMe);
  const isTurn = snapshot.room.status === "playing" && snapshot.room.currentPlayerId === me?.id;
  const phase = snapshot.room.phase;
  const battleBusy = Boolean(snapshot.room.battle);
  const myTerritories = useMemo(() => snapshot.territories.filter((territory) => territory.ownerPlayerId === me?.id), [me?.id, snapshot.territories]);
  const selectedSource = from ? snapshot.territories.find((territory) => territory.territoryId === Number(from)) : undefined;
  const targetIds = useMemo(() => selectedSource
    ? snapshot.connections.filter((connection) => connection.passable && (connection.territoryA === selectedSource.territoryId || connection.territoryB === selectedSource.territoryId)).map((connection) => connection.territoryA === selectedSource.territoryId ? connection.territoryB : connection.territoryA).filter((id) => {
        const territory = snapshot.territories.find((item) => item.territoryId === id);
        return phase === "attack" ? territory?.ownerPlayerId !== me?.id : territory?.ownerPlayerId === me?.id;
      })
    : [], [me?.id, phase, selectedSource, snapshot.connections, snapshot.territories]);
  const canTrade = snapshot.myCards.some((first, index) => snapshot.myCards.slice(index + 1).some((second, secondIndex) => snapshot.myCards.slice(index + secondIndex + 2).some((third) => isValidTrade([first.symbol, second.symbol, third.symbol]))));

  useEffect(() => {
    const previous = previousCards.current;
    const received = snapshot.myCards.find((card) => previous.size > 0 && !previous.has(card.id));
    previousCards.current = new Set(snapshot.myCards.map((card) => card.id));
    if (!received) return;
    setDrawnCard(received);
    const timeout = window.setTimeout(() => setDrawnCard(null), 1_700);
    return () => window.clearTimeout(timeout);
  }, [snapshot.myCards]);

  const pendingConquestFrom = snapshot.room.pendingConquest?.fromTerritoryId ?? null;
  const pendingConquestTo = snapshot.room.pendingConquest?.toTerritoryId ?? null;

  useEffect(() => {
    if (isTurn && pendingConquestFrom !== null && pendingConquestTo !== null && !battleBusy) {
      queueMicrotask(() => {
        setCount("1");
        setModal("conquest");
      });
    }
  }, [battleBusy, isTurn, pendingConquestFrom, pendingConquestTo]);

  useEffect(() => {
    if (selectedTerritoryId !== null) return;
    queueMicrotask(() => { setFrom(""); setTo(""); setModal(current => current === "maneuver" ? null : current); });
    onMapArrow(null);
    lastSelection.current = null;
  }, [onMapArrow, selectedTerritoryId]);

  useEffect(() => {
    if (!isTurn || battleBusy) return onMapHints({ available: [], targets: [] });
    if (phase === "reinforcement") return onMapHints({ available: myTerritories.map((territory) => territory.territoryId), targets: [] });
    if (phase === "attack") return onMapHints({ available: selectedSource ? [] : myTerritories.filter((territory) => territory.troops > 1).map((territory) => territory.territoryId), targets: targetIds });
    if (phase === "maneuver") return onMapHints({ available: selectedSource ? [] : myTerritories.filter((territory) => territory.troops - territory.movedInTurn > 1).map((territory) => territory.territoryId), targets: targetIds });
    onMapHints({ available: [], targets: [] });
  }, [battleBusy, isTurn, myTerritories, onMapHints, phase, selectedSource, targetIds]);

  useEffect(() => {
    if (!isTurn || battleBusy || !selectedTerritoryId || lastSelection.current === selectedTerritoryId) return;
    lastSelection.current = selectedTerritoryId;
    const selected = snapshot.territories.find((territory) => territory.territoryId === selectedTerritoryId);
    if (!selected) return;
    if (phase === "reinforcement" && selected.ownerPlayerId === me?.id) queueMicrotask(() => { setTo(String(selectedTerritoryId)); setCount("1"); setModal("reinforce"); });
    if (phase === "attack") {
      if (!from && selected.ownerPlayerId === me?.id && selected.troops > 1) queueMicrotask(() => setFrom(String(selectedTerritoryId)));
      else if (from && targetIds.includes(selectedTerritoryId)) { void action("attack", { fromTerritoryId: Number(from), toTerritoryId: selectedTerritoryId }).then(() => setFrom("")); }
      else if (from) { const connection = findTerritoryConnection(snapshot.connections, Number(from), selectedTerritoryId); if (connection.exists && !connection.passable) queueMicrotask(() => setBarrier(connection)); }
    }
    if (phase === "maneuver") {
      if (!from && selected.ownerPlayerId === me?.id && selected.troops - selected.movedInTurn > 1) queueMicrotask(() => setFrom(String(selectedTerritoryId)));
      else if (from && targetIds.includes(selectedTerritoryId)) queueMicrotask(() => { setTo(String(selectedTerritoryId)); setCount("1"); setModal("maneuver"); onMapArrow({ fromTerritoryId: Number(from), toTerritoryId: selectedTerritoryId, kind: "movement" }); });
      else if (from) { const connection = findTerritoryConnection(snapshot.connections, Number(from), selectedTerritoryId); if (connection.exists && !connection.passable) queueMicrotask(() => setBarrier(connection)); }
    }
  // A ação usa apenas o snapshot capturado pelo clique que a disparou.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleBusy, from, isTurn, me?.id, onMapArrow, phase, selectedTerritoryId, snapshot.connections, snapshot.territories, targetIds]);

  async function action(path: string, body: Record<string, unknown>) {
    setMessage("");
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(roomId)}/${path}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
            ? data.error
            : "Não foi possível concluir a ação.",
        );
      }
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    }
  }

  if (snapshot.room.status === "order_roll") return null;
  return (
    <section className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-5 shadow-[0_18px_50px_rgba(42,55,50,0.07)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7a27]">Turno {snapshot.room.turnNumber}</p>
          <h2 className="mt-1 text-xl font-semibold">{snapshot.room.status === "finished" ? "Partida encerrada" : `Fase: ${phase}`}</h2>
        </div>
        <span className="rounded-full bg-[#e3eee6] px-3 py-1 text-xs font-semibold text-[#326347]">
          {isTurn ? "Seu turno" : "Aguardando outro jogador"}
        </span>
      </div>
      {snapshot.myObjective ? <p className="mt-4 rounded-xl bg-[#12392f] p-4 text-sm text-white"><strong>Objetivo secreto:</strong> {snapshot.myObjective.description.replace("{targetPlayer}", snapshot.myObjective.targetFactionName ?? "outro jogador")}</p> : null}
      {snapshot.room.status === "finished" ? <p className="mt-4 text-sm text-[#326347]">Vitória de {snapshot.players.find((player) => player.id === snapshot.room.winnerPlayerId)?.factionName ?? "uma facção"}.</p> : null}

      {isTurn && phase === "cards" ? (
        <div className="mt-5"><button type="button" onClick={() => action("phase", { action: "finishCards" })} className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Iniciar reforços</button></div>
      ) : null}
      {isTurn && phase === "reinforcement" ? <div className="mt-5 flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-[#326347]">{snapshot.room.reinforcementsRemaining} reforços restantes. Selecione um território no mapa.</p>{canTrade ? <button type="button" onClick={() => setModal("cards")} className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]">Pedir reforços</button> : null}</div> : null}
      {isTurn && phase === "attack" ? <div className="mt-5 space-y-3"><p className="text-sm text-[#64756f]">{snapshot.room.pendingConquest ? "Escolha as tropas para a conquista pendente." : battleBusy ? "Acompanhe a resolução do combate." : from ? "Agora selecione um território inimigo destacado." : "Selecione um território próprio com pelo menos 2 tropas."}</p><button type="button" disabled={Boolean(snapshot.room.pendingConquest) || battleBusy} onClick={() => action("phase", { action: "finishAttack" })} className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40">Ir para deslocamento</button></div> : null}
      {isTurn && phase === "maneuver" ? <div className="mt-5 space-y-3"><p className="text-sm text-[#64756f]">{from ? "Escolha um território próprio adjacente destacado." : "Selecione a origem do deslocamento no mapa."}</p><button type="button" onClick={() => action("phase", { action: "endTurn" })} className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Encerrar turno</button></div> : null}
      <div className="sticky bottom-2 z-10 mt-6 flex flex-wrap justify-center gap-2 rounded-2xl border border-[#17372d]/10 bg-[#faf8f2]/95 p-3 shadow-lg backdrop-blur border-t pt-4">
        {snapshot.myCards.map((card) => <TerritoryCard key={card.id} territoryId={card.territoryId} symbol={card.symbol} selected={selectedCards.includes(card.id)} onClick={() => modal === "cards" && setSelectedCards((cards) => cards.includes(card.id) ? cards.filter((id) => id !== card.id) : cards.length < 3 ? [...cards, card.id] : cards)} />)}
      </div>
      {modal ? <div className="fixed inset-0 z-30 grid place-items-center bg-[#14241f]/45 p-4"><div className="w-full max-w-sm rounded-3xl bg-[#faf8f2] p-6 shadow-2xl"><h3 className="text-xl font-semibold">{modal === "cards" ? "Pedir reforços" : modal === "conquest" ? "Mover tropas conquistadoras" : modal === "maneuver" ? "Deslocar tropas" : "Adicionar reforços"}</h3>{modal === "cards" ? <><p className="mt-2 text-sm text-[#64756f]">Selecione três cartas na sua mão.</p><button type="button" disabled={selectedCards.length !== 3} onClick={() => action("cards/trade", { cardIds: selectedCards }).then(() => { setSelectedCards([]); setModal(null); })} className="mt-5 rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40">Confirmar troca</button></> : <><p className="mt-2 text-sm text-[#64756f]">{modal === "conquest" ? `Tropas no território de origem: ${snapshot.territories.find(territory => territory.territoryId === snapshot.room.pendingConquest?.fromTerritoryId)?.troops ?? 0}. Máximo que pode ser movido: ${Math.max(0, (snapshot.territories.find(territory => territory.territoryId === snapshot.room.pendingConquest?.fromTerritoryId)?.troops ?? 1) - 1)}.` : modal === "maneuver" ? `Tropas na origem: ${selectedSource?.troops ?? 0}. Máximo transferível: ${Math.max(0, (selectedSource?.troops ?? 1) - (selectedSource?.movedInTurn ?? 0) - 1)}.` : null}</p><NumberField label="Tropas" value={count} setValue={setCount}/><div className="mt-5 flex gap-3"><button type="button" onClick={() => { const path=modal === "reinforce" ? "reinforce" : modal === "conquest" ? "conquest" : "maneuver"; const body=modal === "reinforce" ? { territoryId: Number(to), troops: Number(count) } : modal === "conquest" ? { troops: Number(count) } : { fromTerritoryId: Number(from), toTerritoryId: Number(to), troops: Number(count) }; void action(path, body).then(() => { setModal(null); setFrom(""); onMapArrow(null); }); }} className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Confirmar</button><button type="button" onClick={() => { setModal(null); setTo(""); onMapArrow(null); }} className="rounded-xl border border-[#17372d]/15 px-4 py-3 text-xs font-bold uppercase tracking-wider">Cancelar</button></div></>}</div></div> : null}
      {isTurn && snapshot.room.pendingConquest && modal !== "conquest" ? <button type="button" onClick={() => { setCount("1"); setModal("conquest"); }} className="mt-4 rounded-xl bg-[#a33c33] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Concluir conquista</button> : null}
      {barrier ? <div className="fixed bottom-5 left-1/2 z-40 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-[#e4b94f]/60 bg-[#17372d] p-4 text-white shadow-xl"><p className="font-semibold">Fronteira bloqueada — {barrier.barrierName ?? "barreira natural"}</p><p className="mt-1 text-sm text-[#d4e2dc]">{barrier.description ?? "Esta barreira impede uma rota militar direta entre esses territórios."}</p><button type="button" onClick={() => setBarrier(null)} className="mt-3 text-xs font-bold uppercase tracking-wider text-[#e8c35e]">Fechar</button></div> : null}
      {drawnCard ? <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center"><div className="card-draw-animation"><TerritoryCard territoryId={drawnCard.territoryId} symbol={drawnCard.symbol} /></div></div> : null}
      {message ? <p className="mt-4 text-sm text-[#a33c33]">{message}</p> : null}
    </section>
  );
}

function NumberField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-[#52635d]">{label}<input type="number" min="1" value={value} onChange={(event) => setValue(event.target.value)} className="rounded-lg border border-[#17372d]/15 bg-white px-3 py-2 text-sm text-[#14241f]" /></label>;
}

function BattleOverlay({ roomId, battle, players, meId, onRefresh }: { roomId:string; battle:NonNullable<GameSnapshot["room"]["battle"]>; players:GameSnapshot["players"]; meId:string|undefined; onRefresh:()=>Promise<void> }) {
  const [error,setError]=useState(""); const [rolling,setRolling]=useState(false);
  const attacker=players.find(player=>player.id===battle.attackerPlayerId),defender=players.find(player=>player.id===battle.defenderPlayerId);
  const canRoll=(battle.stage==="awaiting_attacker_roll"&&meId===battle.attackerPlayerId)||(battle.stage==="awaiting_defender_roll"&&meId===battle.defenderPlayerId);
  const label=battle.stage==="awaiting_attacker_roll"?"Aguardando o atacante...":battle.stage==="show_attacker_result"?"Resultado do atacante":battle.stage==="awaiting_defender_roll"?"Aguardando o defensor...":battle.stage==="show_defender_result"?"Resultado do defensor":battle.stage==="show_comparison"?"Comparando os dados":battle.conquered?"Território conquistado":"Resultado da batalha";
  async function roll(){setError("");setRolling(true);try{const response=await fetch(`/api/games/${encodeURIComponent(roomId)}/attack/roll`,{method:"POST",cache:"no-store"});const data:unknown=await response.json();if(!response.ok)throw new Error(typeof data==="object"&&data!==null&&"error" in data&&typeof data.error==="string"?data.error:"Não foi possível rolar os dados.");await onRefresh();}catch(requestError){setError(requestError instanceof Error?requestError.message:"Não foi possível rolar os dados.");}finally{window.setTimeout(()=>setRolling(false),850);}}
  const pairs=Array.from({length:Math.min(battle.attacker.length,battle.defender.length)},(_,index)=>({attack:battle.attacker[index],defense:battle.defender[index]}));
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[#14241f]/35 p-4 pointer-events-none"><section className="pointer-events-auto w-full max-w-xl rounded-3xl bg-[#12392f] p-6 text-white shadow-2xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9eb8ae]">Combate sincronizado</p><h2 className="mt-2 text-2xl font-semibold">{label}</h2><p className="mt-1 text-sm text-[#c8d9d1]">{attacker?.factionName??"Atacante"} × {defender?.factionName??"Defensor"}</p><div className="mt-6 flex justify-center gap-8">{battle.attacker.length?<div className="text-center"><p className="mb-2 text-xs text-[#b9ccc4]">Ataque</p><div className="flex justify-center gap-2">{battle.attacker.map((value,index)=><BrazilDie key={`${value}-${index}-${battle.stage}`} value={value} color={attacker?.color??"forest"} isRolling={rolling||battle.stage==="show_attacker_result"}/>)}</div></div>:null}{battle.defender.length?<div className="text-center"><p className="mb-2 text-xs text-[#b9ccc4]">Defesa</p><div className="flex justify-center gap-2">{battle.defender.map((value,index)=><BrazilDie key={`${value}-${index}-${battle.stage}`} value={value} color={defender?.color??"ruby"} isRolling={rolling||battle.stage==="show_defender_result"}/>)}</div></div>:null}</div>{battle.stage==="show_comparison"||battle.stage==="show_battle_result"?<div className="mt-6 space-y-1 rounded-2xl bg-white/8 p-4 text-sm">{pairs.map((pair,index)=><p key={index}>Ataque {pair.attack} × Defesa {pair.defense} → {pair.attack>pair.defense?"defesa perde 1":"ataque perde 1"}</p>)}</div>:null}{battle.stage==="show_battle_result"?<p className="mt-5 text-sm font-semibold text-[#e8c35e]">Perdas: atacante {battle.attackerLosses} · defesa {battle.defenderLosses}{battle.conquered?" · conquista aguardando transferência":""}</p>:null}{canRoll?<button type="button" onClick={()=>void roll()} disabled={rolling} className="mt-6 h-12 w-full rounded-xl bg-[#e4b94f] text-xs font-bold uppercase tracking-[.14em] text-[#12392f] disabled:opacity-50">{rolling?"Rolando…":"Rolar dados"}</button>:null}{error?<p className="mt-3 text-sm text-[#ffd2c9]">{error}</p>:null}</section></div>;
}

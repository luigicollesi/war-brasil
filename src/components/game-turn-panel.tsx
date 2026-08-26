"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TerritoryCard } from "@/src/components/territory-card";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import type { GameSnapshot } from "@/src/lib/game";
import { isValidTrade } from "@/src/lib/game-rules";
import {
  findTerritoryConnection,
  reachableTerritoryIds,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";

type GameTurnPanelProps = {
  roomId: string;
  snapshot: GameSnapshot;
  selectedTerritoryId: number | null;
  selectionVersion: number;
  onRefresh: () => Promise<void>;
  onMapHints: (hints: { available: number[]; targets: number[] }) => void;
  onMapArrow: (
    arrow: {
      fromTerritoryId: number;
      toTerritoryId: number;
      kind: "movement";
    } | null,
  ) => void;
};

type QuantityMode = "reinforce" | "conquest" | "maneuver";

type TroopQuantitySelectorProps = {
  mode: QuantityMode;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  sourceName?: string;
  targetName: string;
  sourceBefore?: number;
  sourceAfter?: number;
  targetBefore: number;
  targetAfter: number;
  availableLabel: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function territoryName(territoryId: number | null | undefined) {
  if (!territoryId) return "Território";
  return TERRITORY_METADATA[territoryId]?.name ?? `Território ${territoryId}`;
}

function troopLabel(value: number) {
  return value === 1 ? "tropa" : "tropas";
}

function TroopQuantitySelector({
  mode,
  value,
  min,
  max,
  onChange,
  sourceName,
  targetName,
  sourceBefore,
  sourceAfter,
  targetBefore,
  targetAfter,
  availableLabel,
}: TroopQuantitySelectorProps) {
  const midpoint = Math.floor((min + max) / 2);
  const atMin = value <= min;
  const atMax = value >= max;
  const setSafe = (next: number) => onChange(clamp(next, min, max));

  return (
    <div
      className={`troop-quantity-selector troop-quantity-selector--${mode}`}
      role="spinbutton"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          setSafe(value - 1);
        }
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          setSafe(value + 1);
        }
        if (event.key === "Home") {
          event.preventDefault();
          setSafe(min);
        }
        if (event.key === "End") {
          event.preventDefault();
          setSafe(max);
        }
      }}
    >
      <div className="troop-flow-preview" aria-live="polite">
        {mode === "reinforce" ? (
          <div className="troop-flow-single">
            <span className="troop-flow-name">{targetName}</span>
            <div className="troop-flow-numbers">
              <span>{targetBefore}</span>
              <span className="troop-flow-arrow">→</span>
              <strong>{targetAfter}</strong>
            </div>
            <span className="troop-flow-caption">+{value} {troopLabel(value)}</span>
          </div>
        ) : (
          <div className="troop-flow-transfer">
            <div className="troop-flow-side">
              <span className="troop-flow-name">{sourceName}</span>
              <strong>{sourceBefore}</strong>
              <small>fica com {sourceAfter}</small>
            </div>
            <div className="troop-flow-center">
              <span className="troop-flow-transfer-value">{value}</span>
              <span className="troop-flow-direction">━━▶</span>
              <small>{troopLabel(value)}</small>
            </div>
            <div className="troop-flow-side troop-flow-side--target">
              <span className="troop-flow-name">{targetName}</span>
              <strong>{targetBefore}</strong>
              <small>fica com {targetAfter}</small>
            </div>
          </div>
        )}
      </div>

      <p className="troop-quantity-available">{availableLabel}</p>

      <div className="troop-stepper">
        <button
          type="button"
          className="troop-stepper-button"
          disabled={atMin}
          onClick={() => setSafe(value - 1)}
          aria-label="Diminuir uma tropa"
        >
          −
        </button>
        <div className="troop-stepper-value">
          <strong>{value}</strong>
          <span>{troopLabel(value)}</span>
        </div>
        <button
          type="button"
          className="troop-stepper-button"
          disabled={atMax}
          onClick={() => setSafe(value + 1)}
          aria-label="Aumentar uma tropa"
        >
          +
        </button>
      </div>

      <div className="troop-range-wrap">
        <input
          className="troop-range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={min === max}
          onChange={(event) => setSafe(Number(event.target.value))}
          aria-label="Quantidade de tropas"
        />
        <div className="troop-range-limits" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      <div className="troop-quick-values">
        <button type="button" onClick={() => setSafe(min)} disabled={value === min}>
          <span>MÍN</span>
          <strong>{min}</strong>
        </button>
        <button type="button" onClick={() => setSafe(midpoint)} disabled={value === midpoint}>
          <span>METADE</span>
          <strong>{midpoint}</strong>
        </button>
        <button type="button" onClick={() => setSafe(max)} disabled={value === max}>
          <span>MÁX</span>
          <strong>{max}</strong>
        </button>
      </div>
    </div>
  );
}

export function GameTurnPanel({
  roomId,
  snapshot,
  selectedTerritoryId,
  selectionVersion,
  onRefresh,
  onMapHints,
  onMapArrow,
}: GameTurnPanelProps) {
  const [message, setMessage] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState(1);
  const [modal, setModal] = useState<
    "reinforce" | "maneuver" | "conquest" | "cards" | null
  >(null);
  const [drawnCard, setDrawnCard] = useState<
    GameSnapshot["myCards"][number] | null
  >(null);
  const [barrier, setBarrier] = useState<TerritoryConnection | null>(null);
  const handledSelectionVersion = useRef(-1);
  const previousCards = useRef(new Set<string>());

  const me = snapshot.players.find((player) => player.isMe);
  const isTurn =
    snapshot.room.status === "playing" &&
    snapshot.room.currentPlayerId === me?.id;
  const phase = snapshot.room.phase;
  const battleBusy = Boolean(snapshot.room.battle);
  const myTerritories = useMemo(
    () =>
      snapshot.territories.filter(
        (territory) => territory.ownerPlayerId === me?.id,
      ),
    [me?.id, snapshot.territories],
  );
  const selectedSource = from
    ? snapshot.territories.find(
        (territory) => territory.territoryId === Number(from),
      )
    : undefined;

  const targetIds = useMemo(() => {
    if (!selectedSource) return [];

    if (phase === "maneuver") {
      return reachableTerritoryIds(
        snapshot.connections,
        selectedSource.territoryId,
        myTerritories.map((territory) => territory.territoryId),
      ).filter((territoryId) => territoryId !== selectedSource.territoryId);
    }

    if (phase === "attack") {
      return snapshot.connections
        .filter(
          (connection) =>
            connection.passable &&
            (connection.territoryA === selectedSource.territoryId ||
              connection.territoryB === selectedSource.territoryId),
        )
        .map((connection) =>
          connection.territoryA === selectedSource.territoryId
            ? connection.territoryB
            : connection.territoryA,
        )
        .filter((territoryId) => {
          const territory = snapshot.territories.find(
            (item) => item.territoryId === territoryId,
          );
          return territory?.ownerPlayerId !== me?.id;
        });
    }

    return [];
  }, [
    me?.id,
    myTerritories,
    phase,
    selectedSource,
    snapshot.connections,
    snapshot.territories,
  ]);

  const canTrade = snapshot.myCards.some((first, index) =>
    snapshot.myCards.slice(index + 1).some((second, secondIndex) =>
      snapshot.myCards
        .slice(index + secondIndex + 2)
        .some((third) =>
          isValidTrade([first.symbol, second.symbol, third.symbol]),
        ),
    ),
  );

  const pendingConquestFrom =
    snapshot.room.pendingConquest?.fromTerritoryId ?? null;
  const pendingConquestTo =
    snapshot.room.pendingConquest?.toTerritoryId ?? null;
  const conquestSource = pendingConquestFrom
    ? snapshot.territories.find(
        (territory) => territory.territoryId === pendingConquestFrom,
      )
    : undefined;
  const conquestTarget = pendingConquestTo
    ? snapshot.territories.find(
        (territory) => territory.territoryId === pendingConquestTo,
      )
    : undefined;
  const selectedTarget = to
    ? snapshot.territories.find(
        (territory) => territory.territoryId === Number(to),
      )
    : undefined;

  const quantityMax =
    modal === "reinforce"
      ? snapshot.room.reinforcementsRemaining
      : modal === "conquest"
        ? Math.max(0, (conquestSource?.troops ?? 1) - 1)
        : modal === "maneuver"
          ? Math.max(
              0,
              (selectedSource?.troops ?? 1) -
                (selectedSource?.movedInTurn ?? 0) -
                1,
            )
          : 0;
  const quantityValid = quantityMax >= 1;
  const safeQuantityMax = Math.max(1, quantityMax);

  useEffect(() => {
    const previous = previousCards.current;
    const received = snapshot.myCards.find(
      (card) => previous.size > 0 && !previous.has(card.id),
    );

    previousCards.current = new Set(snapshot.myCards.map((card) => card.id));
    if (!received) return;

    queueMicrotask(() => setDrawnCard(received));
  }, [snapshot.myCards]);

  useEffect(() => {
    if (!modal || modal === "cards") return;
    queueMicrotask(() => {
      setCount((current) => clamp(current, 1, safeQuantityMax));
    });
  }, [modal, safeQuantityMax]);

  useEffect(() => {
    if (
      isTurn &&
      pendingConquestFrom !== null &&
      pendingConquestTo !== null &&
      !battleBusy
    ) {
      queueMicrotask(() => {
        setCount(1);
        setModal("conquest");
      });
    }
  }, [battleBusy, isTurn, pendingConquestFrom, pendingConquestTo]);

  useEffect(() => {
    if (selectedTerritoryId !== null) return;
    queueMicrotask(() => {
      setFrom("");
      setTo("");
      setModal((current) => (current === "maneuver" ? null : current));
    });
    onMapArrow(null);
  }, [onMapArrow, selectedTerritoryId]);

  useEffect(() => {
    if (!isTurn || battleBusy) {
      return onMapHints({ available: [], targets: [] });
    }
    if (phase === "reinforcement") {
      return onMapHints({
        available: myTerritories.map((territory) => territory.territoryId),
        targets: [],
      });
    }
    if (phase === "attack") {
      return onMapHints({
        available: selectedSource
          ? []
          : myTerritories
              .filter((territory) => territory.troops > 1)
              .map((territory) => territory.territoryId),
        targets: targetIds,
      });
    }
    if (phase === "maneuver") {
      return onMapHints({
        available: selectedSource
          ? []
          : myTerritories
              .filter(
                (territory) =>
                  territory.troops - territory.movedInTurn > 1,
              )
              .map((territory) => territory.territoryId),
        targets: targetIds,
      });
    }
    onMapHints({ available: [], targets: [] });
  }, [
    battleBusy,
    isTurn,
    myTerritories,
    onMapHints,
    phase,
    selectedSource,
    targetIds,
  ]);

  useEffect(() => {
    if (handledSelectionVersion.current === selectionVersion) return;
    handledSelectionVersion.current = selectionVersion;
    if (!isTurn || battleBusy || !selectedTerritoryId) return;

    const selected = snapshot.territories.find(
      (territory) => territory.territoryId === selectedTerritoryId,
    );
    if (!selected) return;

    if (phase === "reinforcement" && selected.ownerPlayerId === me?.id) {
      queueMicrotask(() => {
        setTo(String(selectedTerritoryId));
        setCount(1);
        setModal("reinforce");
      });
      return;
    }

    if (phase === "attack") {
      if (!from) {
        if (selected.ownerPlayerId === me?.id && selected.troops > 1) {
          queueMicrotask(() => setFrom(String(selectedTerritoryId)));
        }
        return;
      }

      const sourceId = Number(from);
      const connection = findTerritoryConnection(
        snapshot.connections,
        sourceId,
        selectedTerritoryId,
      );

      if (
        selected.ownerPlayerId !== me?.id &&
        connection.exists &&
        connection.passable
      ) {
        void action("attack", {
          fromTerritoryId: sourceId,
          toTerritoryId: selectedTerritoryId,
        }).then((success) => {
          if (success) setFrom("");
        });
        return;
      }

      if (connection.exists && !connection.passable) {
        queueMicrotask(() => setBarrier(connection));
      }
      return;
    }

    if (phase === "maneuver") {
      if (!from) {
        if (
          selected.ownerPlayerId === me?.id &&
          selected.troops - selected.movedInTurn > 1
        ) {
          queueMicrotask(() => setFrom(String(selectedTerritoryId)));
        }
        return;
      }

      const sourceId = Number(from);
      if (
        selected.ownerPlayerId === me?.id &&
        targetIds.includes(selectedTerritoryId)
      ) {
        queueMicrotask(() => {
          setTo(String(selectedTerritoryId));
          setCount(1);
          setModal("maneuver");
          onMapArrow({
            fromTerritoryId: sourceId,
            toTerritoryId: selectedTerritoryId,
            kind: "movement",
          });
        });
        return;
      }

      const directConnection = findTerritoryConnection(
        snapshot.connections,
        sourceId,
        selectedTerritoryId,
      );
      if (directConnection.exists && !directConnection.passable) {
        queueMicrotask(() => setBarrier(directConnection));
      }
    }

    // Processa apenas cliques reais do usuário; heartbeats não repetem ações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    battleBusy,
    from,
    isTurn,
    me?.id,
    onMapArrow,
    phase,
    selectedTerritoryId,
    selectionVersion,
    snapshot.connections,
    snapshot.territories,
  ]);

  async function action(path: string, body: Record<string, unknown>) {
    setMessage("");
    try {
      const response = await fetch(
        `/api/games/${encodeURIComponent(roomId)}/${path}`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
            ? data.error
            : "Não foi possível concluir a ação.",
        );
      }
      await onRefresh();
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
      );
      return false;
    }
  }

  async function submitQuantity() {
    if (!modal || modal === "cards" || !quantityValid) return;

    const troops = clamp(count, 1, quantityMax);
    const path =
      modal === "reinforce"
        ? "reinforce"
        : modal === "conquest"
          ? "conquest"
          : "maneuver";
    const body =
      modal === "reinforce"
        ? { territoryId: Number(to), troops }
        : modal === "conquest"
          ? { troops }
          : {
              fromTerritoryId: Number(from),
              toTerritoryId: Number(to),
              troops,
            };

    if (!(await action(path, body))) return;

    setModal(null);
    setFrom("");
    setTo("");
    onMapArrow(null);
  }

  if (snapshot.room.status === "order_roll") return null;

  const quantityMode =
    modal === "reinforce" || modal === "conquest" || modal === "maneuver"
      ? modal
      : null;
  const quantityTitle =
    quantityMode === "reinforce"
      ? "Mobilizar reforços"
      : quantityMode === "conquest"
        ? "Território conquistado"
        : "Reposicionar exército";
  const quantityEyebrow =
    quantityMode === "reinforce"
      ? "Fase de reforço"
      : quantityMode === "conquest"
        ? "Conquista confirmada"
        : "Manobra estratégica";
  const quantityCta = `${
    quantityMode === "reinforce" ? "POSICIONAR" : "MOVER"
  } ${count} ${troopLabel(count).toUpperCase()}`;

  const quantityTarget =
    quantityMode === "conquest" ? conquestTarget : selectedTarget;
  const quantitySource =
    quantityMode === "conquest" ? conquestSource : selectedSource;
  const quantityTargetBefore = quantityTarget?.troops ?? 0;
  const quantityTargetAfter =
    quantityMode === "reinforce"
      ? quantityTargetBefore + count
      : quantityMode === "conquest"
        ? count
        : quantityTargetBefore + count;
  const quantitySourceBefore = quantitySource?.troops;
  const quantitySourceAfter =
    quantitySourceBefore === undefined ? undefined : quantitySourceBefore - count;
  const availableLabel =
    quantityMode === "reinforce"
      ? `${snapshot.room.reinforcementsRemaining} reforços disponíveis`
      : quantityMode === "conquest"
        ? `de 1 a ${safeQuantityMax} · 1 tropa precisa permanecer na origem`
        : `de 1 a ${safeQuantityMax} · já movidas: ${selectedSource?.movedInTurn ?? 0}`;

  return (
    <section className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-5 shadow-[0_18px_50px_rgba(42,55,50,0.07)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7a27]">
            Turno {snapshot.room.turnNumber}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {snapshot.room.status === "finished"
              ? "Partida encerrada"
              : `Fase: ${phase}`}
          </h2>
        </div>
        <span className="rounded-full bg-[#e3eee6] px-3 py-1 text-xs font-semibold text-[#326347]">
          {isTurn ? "Seu turno" : "Aguardando outro jogador"}
        </span>
      </div>

      {snapshot.myObjective ? (
        <p className="mt-4 rounded-xl bg-[#12392f] p-4 text-sm text-white">
          <strong>Objetivo secreto:</strong>{" "}
          {snapshot.myObjective.description.replace(
            "{targetPlayer}",
            snapshot.myObjective.targetFactionName ?? "outro jogador",
          )}
        </p>
      ) : null}

      {snapshot.room.status === "finished" ? (
        <p className="mt-4 text-sm text-[#326347]">
          Vitória de{" "}
          {snapshot.players.find(
            (player) => player.id === snapshot.room.winnerPlayerId,
          )?.factionName ?? "uma facção"}
          .
        </p>
      ) : null}

      {isTurn && phase === "cards" ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void action("phase", { action: "finishCards" })}
            className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white"
          >
            Iniciar reforços
          </button>
        </div>
      ) : null}

      {isTurn && phase === "reinforcement" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-[#326347]">
            {snapshot.room.reinforcementsRemaining} reforços restantes. Selecione
            um território no mapa.
          </p>
          {canTrade ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCards([]);
                setModal("cards");
              }}
              className="rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f]"
            >
              Pedir reforços
            </button>
          ) : null}
        </div>
      ) : null}

      {isTurn && phase === "attack" ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[#64756f]">
            {snapshot.room.pendingConquest
              ? "Escolha as tropas para a conquista pendente."
              : battleBusy
                ? "Acompanhe a resolução do combate."
                : from
                  ? "Agora selecione um território inimigo destacado."
                  : "Selecione um território próprio com pelo menos 2 tropas."}
          </p>
          <button
            type="button"
            disabled={Boolean(snapshot.room.pendingConquest) || battleBusy}
            onClick={() => void action("phase", { action: "finishAttack" })}
            className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40"
          >
            Ir para deslocamento
          </button>
        </div>
      ) : null}

      {isTurn && phase === "maneuver" ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[#64756f]">
            {from
              ? "Escolha qualquer território próprio conectado à origem."
              : "Selecione a origem do deslocamento no mapa."}
          </p>
          <button
            type="button"
            onClick={() => void action("phase", { action: "endTurn" })}
            className="rounded-xl bg-[#12392f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white"
          >
            Encerrar turno
          </button>
        </div>
      ) : null}

      <div className="sticky bottom-2 z-10 mt-6 flex flex-wrap justify-center gap-2 rounded-2xl border border-[#17372d]/10 bg-[#faf8f2]/95 p-3 pt-4 shadow-lg backdrop-blur">
        {snapshot.myCards.map((card) => (
          <TerritoryCard
            key={card.id}
            territoryId={card.territoryId}
            symbol={card.symbol}
            selected={selectedCards.includes(card.id)}
            onClick={() =>
              modal === "cards" &&
              setSelectedCards((cards) =>
                cards.includes(card.id)
                  ? cards.filter((id) => id !== card.id)
                  : cards.length < 3
                    ? [...cards, card.id]
                    : cards,
              )
            }
          />
        ))}
      </div>

      {modal ? (
        <div className="game-modal-backdrop fixed inset-0 z-30 grid place-items-center p-4">
          <div
            className={`game-modal-surface ${
              modal === "cards" ? "game-card-modal" : "game-action-modal"
            } w-full ${modal === "cards" ? "max-w-lg" : "max-w-md"} p-6`}
          >
            {modal === "cards" ? (
              <>
                <p className="game-modal-eyebrow">Troca de cartas</p>
                <h3 className="text-xl font-semibold">Pedir reforços</h3>
                <p className="mt-2 text-sm text-[#64756f]">
                  Selecione três cartas na sua mão. {selectedCards.length}/3
                  selecionadas.
                </p>

                <div className="mt-5 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
                  {snapshot.myCards.map((card) => (
                    <TerritoryCard
                      key={card.id}
                      territoryId={card.territoryId}
                      symbol={card.symbol}
                      selected={selectedCards.includes(card.id)}
                      onClick={() =>
                        setSelectedCards((cards) =>
                          cards.includes(card.id)
                            ? cards.filter((id) => id !== card.id)
                            : cards.length < 3
                              ? [...cards, card.id]
                              : cards,
                        )
                      }
                    />
                  ))}
                </div>

                <div className="game-modal-actions mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={selectedCards.length !== 3}
                    onClick={() => {
                      void action("cards/trade", {
                        cardIds: selectedCards,
                      }).then((success) => {
                        if (!success) return;
                        setSelectedCards([]);
                        setModal(null);
                      });
                    }}
                    className="game-primary-action rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
                  >
                    Confirmar troca
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCards([]);
                      setModal(null);
                    }}
                    className="game-secondary-action rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : quantityMode ? (
              <>
                <p className="game-modal-eyebrow">{quantityEyebrow}</p>
                <h3 className="text-xl font-semibold">{quantityTitle}</h3>

                {quantityValid ? (
                  <TroopQuantitySelector
                    mode={quantityMode}
                    value={count}
                    min={1}
                    max={safeQuantityMax}
                    onChange={setCount}
                    sourceName={
                      quantityMode === "reinforce"
                        ? undefined
                        : territoryName(quantitySource?.territoryId)
                    }
                    targetName={territoryName(quantityTarget?.territoryId)}
                    sourceBefore={quantitySourceBefore}
                    sourceAfter={quantitySourceAfter}
                    targetBefore={quantityTargetBefore}
                    targetAfter={quantityTargetAfter}
                    availableLabel={availableLabel}
                  />
                ) : (
                  <p className="game-modal-state-warning">
                    O estado da partida mudou e não há mais tropas disponíveis para
                    esta ação.
                  </p>
                )}

                <div className="game-modal-actions mt-6">
                  <button
                    type="button"
                    disabled={!quantityValid}
                    onClick={() => void submitQuantity()}
                    className="game-primary-action w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] disabled:opacity-40"
                  >
                    {quantityCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      setTo("");
                      onMapArrow(null);
                    }}
                    className="game-cancel-action mt-3 w-full text-xs font-bold uppercase tracking-[0.12em]"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {isTurn && snapshot.room.pendingConquest && modal !== "conquest" ? (
        <button
          type="button"
          onClick={() => {
            setCount(1);
            setModal("conquest");
          }}
          className="mt-4 rounded-xl bg-[#a33c33] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white"
        >
          Concluir conquista
        </button>
      ) : null}

      {barrier ? (
        <div className="fixed bottom-5 left-1/2 z-40 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-[#e4b94f]/60 bg-[#17372d] p-4 text-white shadow-xl">
          <p className="font-semibold">
            Fronteira bloqueada — {barrier.barrierName ?? "barreira natural"}
          </p>
          <p className="mt-1 text-sm text-[#d4e2dc]">
            {barrier.description ??
              "Esta barreira impede uma rota militar direta entre esses territórios."}
          </p>
          <button
            type="button"
            onClick={() => setBarrier(null)}
            className="mt-3 text-xs font-bold uppercase tracking-wider text-[#e8c35e]"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {drawnCard ? (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center">
          <div
            className="card-draw-animation"
            onAnimationEnd={() => setDrawnCard(null)}
          >
            <TerritoryCard
              territoryId={drawnCard.territoryId}
              symbol={drawnCard.symbol}
            />
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-[#a33c33]">{message}</p>
      ) : null}
    </section>
  );
}

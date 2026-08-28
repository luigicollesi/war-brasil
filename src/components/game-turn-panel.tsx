"use client";

import { useEffect, useRef, useState } from "react";
import { GameModal } from "@/src/components/game-modal";
import { TerritoryCard } from "@/src/components/territory-card";
import type { GameInteractionController } from "@/src/hooks/use-game-interaction";
import type { GameSnapshot, GameTerritory } from "@/src/lib/game-contract";
import { runGameCommand } from "@/src/lib/game-command-client";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import type { ManeuverTraversalHint } from "@/src/lib/game-interaction";
import { isValidTrade, maneuverMovableTroops } from "@/src/lib/game-rules";
import type { GameViewModel } from "@/src/lib/game-view-model";

type GameTurnPanelProps = {
  roomId: string;
  snapshot: GameSnapshot;
  game: GameViewModel;
  interaction: GameInteractionController;
  onRefresh: (minimumRevision?: number) => Promise<void>;
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
  maneuverTraversal?: ManeuverTraversalHint;
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
  maneuverTraversal,
}: TroopQuantitySelectorProps) {
  const midpoint = Math.floor((min + max) / 2);
  const atMin = value <= min;
  const atMax = value >= max;
  const setSafe = (next: number) => onChange(clamp(next, min, max));
  const maneuverLoss =
    mode === "maneuver" && maneuverTraversal?.kind === "barrier"
      ? maneuverTraversal.troopLoss
      : 0;
  const arriving = value - maneuverLoss;

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
            <span className="troop-flow-caption">
              +{value} {troopLabel(value)}
            </span>
          </div>
        ) : (
          <div className="troop-flow-transfer">
            <div className="troop-flow-side">
              <span className="troop-flow-name">{sourceName}</span>
              <strong>{sourceBefore}</strong>
              <small>fica com {sourceAfter}</small>
            </div>
            {mode === "maneuver" && maneuverTraversal?.kind === "barrier" ? (
              <div className="troop-flow-center troop-flow-center--barrier">
                <span className="troop-flow-transfer-value">{value} saem</span>
                <span className="troop-flow-barrier-name">
                  ▣ {maneuverTraversal.barrierName ?? "Travessia de barreira"}
                </span>
                <small>
                  -{maneuverLoss} {troopLabel(maneuverLoss)} · {arriving} chegam
                </small>
              </div>
            ) : (
              <div className="troop-flow-center">
                <span className="troop-flow-transfer-value">{value}</span>
                <span className="troop-flow-direction">━━▶</span>
                <small>{troopLabel(value)}</small>
              </div>
            )}
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

type QuantityDialogProps = {
  mode: QuantityMode;
  max: number;
  source?: GameTerritory;
  target?: GameTerritory;
  maneuverTraversal?: ManeuverTraversalHint;
  reinforcementRemaining: number;
  onSubmit: (troops: number) => Promise<boolean>;
  onCancel?: () => void;
};

function QuantityDialog({
  mode,
  max,
  source,
  target,
  maneuverTraversal,
  reinforcementRemaining,
  onSubmit,
  onCancel,
}: QuantityDialogProps) {
  const [requestedCount, setRequestedCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const minimum =
    mode === "maneuver" ? (maneuverTraversal?.minimumTroops ?? 1) : 1;
  const safeMax = Math.max(minimum, max);
  const count = clamp(requestedCount, minimum, safeMax);
  const valid = max >= minimum;
  const maneuverLoss =
    mode === "maneuver" && maneuverTraversal?.kind === "barrier"
      ? maneuverTraversal.troopLoss
      : 0;
  const arriving = count - maneuverLoss;
  const title =
    mode === "reinforce"
      ? "Mobilizar reforços"
      : mode === "conquest"
        ? "Território conquistado"
        : "Reposicionar exército";
  const eyebrow =
    mode === "reinforce"
      ? "Fase de reforço"
      : mode === "conquest"
        ? "Conquista confirmada"
        : "Manobra estratégica";
  const cta =
    mode === "reinforce"
      ? `POSICIONAR ${count} ${troopLabel(count).toUpperCase()}`
      : mode === "maneuver" && maneuverTraversal?.kind === "barrier"
        ? `MOVER ${count} · ${arriving} CHEGAM`
        : `MOVER ${count} ${troopLabel(count).toUpperCase()}`;
  const targetBefore = target?.troops ?? 0;
  const targetAfter =
    mode === "reinforce"
      ? targetBefore + count
      : mode === "conquest"
        ? count
        : targetBefore + arriving;
  const sourceBefore = source?.troops;
  const sourceAfter =
    sourceBefore === undefined ? undefined : sourceBefore - count;
  const availableLabel =
    mode === "reinforce"
      ? `${reinforcementRemaining} reforços disponíveis`
      : mode === "conquest"
        ? `de 1 a ${safeMax} · 1 tropa precisa permanecer na origem`
        : `de ${minimum} a ${safeMax} · já movidas: ${source?.movedInTurn ?? 0}`;
  const invalidMessage =
    mode === "maneuver" && maneuverTraversal?.kind === "barrier"
      ? "A situação da partida mudou e não existem mais tropas suficientes para atravessar esta barreira."
      : "O estado da partida mudou e não há mais tropas disponíveis para esta ação.";

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(count);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GameModal
      eyebrow={eyebrow}
      title={title}
      onClose={onCancel}
      className="game-action-modal w-full max-w-md p-6"
    >
      {mode === "maneuver" && maneuverTraversal?.kind === "barrier" ? (
        <div className="maneuver-barrier-summary mt-4" role="note">
          <p className="font-semibold text-[#f1ca68]">
            ▣ Travessia: {maneuverTraversal.barrierName ?? "barreira natural"}
          </p>
          <p className="mt-1 text-sm text-[#c8d9d1]">
            Uma tropa será perdida durante a travessia. Mova pelo menos 2 tropas.
          </p>
        </div>
      ) : null}

      {valid ? (
        <TroopQuantitySelector
          mode={mode}
          value={count}
          min={minimum}
          max={safeMax}
          onChange={setRequestedCount}
          sourceName={
            mode === "reinforce" ? undefined : territoryName(source?.territoryId)
          }
          targetName={territoryName(target?.territoryId)}
          sourceBefore={sourceBefore}
          sourceAfter={sourceAfter}
          targetBefore={targetBefore}
          targetAfter={targetAfter}
          availableLabel={availableLabel}
          maneuverTraversal={maneuverTraversal}
        />
      ) : (
        <p className="game-modal-state-warning" role="status" aria-live="polite">
          {invalidMessage}
        </p>
      )}

      <div className="game-modal-actions mt-6">
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={() => void submit()}
          className="game-primary-action w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] disabled:opacity-40"
        >
          {submitting ? "PROCESSANDO…" : cta}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="game-cancel-action mt-3 w-full text-xs font-bold uppercase tracking-[0.12em]"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </GameModal>
  );
}

export function GameTurnPanel({
  roomId,
  snapshot,
  game,
  interaction,
  onRefresh,
}: GameTurnPanelProps) {
  const [message, setMessage] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [drawnCard, setDrawnCard] = useState<
    GameSnapshot["myCards"][number] | null
  >(null);
  const previousCards = useRef(new Set<string>());

  const me = game.me;
  const isTurn =
    snapshot.room.status === "playing" &&
    snapshot.room.currentPlayerId === me?.id;
  const phase = snapshot.room.phase;
  const battleBusy = Boolean(snapshot.room.battle);
  const selectedSource =
    interaction.sourceId === null
      ? undefined
      : game.territoriesById.get(interaction.sourceId);
  const localDialog = interaction.dialog;
  const localTarget =
    localDialog?.kind === "reinforce"
      ? game.territoriesById.get(localDialog.targetId)
      : localDialog?.kind === "maneuver"
        ? game.territoriesById.get(localDialog.targetId)
        : undefined;
  const pendingConquest = snapshot.room.pendingConquest;
  const conquestSource = pendingConquest
    ? game.territoriesById.get(pendingConquest.fromTerritoryId)
    : undefined;
  const conquestTarget = pendingConquest
    ? game.territoriesById.get(pendingConquest.toTerritoryId)
    : undefined;

  const canTrade = snapshot.myCards.some((first, index) =>
    snapshot.myCards.slice(index + 1).some((second, secondIndex) =>
      snapshot.myCards
        .slice(index + secondIndex + 2)
        .some((third) =>
          isValidTrade([first.symbol, second.symbol, third.symbol]),
        ),
    ),
  );

  useEffect(() => {
    const previous = previousCards.current;
    const received = snapshot.myCards.find(
      (card) => previous.size > 0 && !previous.has(card.id),
    );

    previousCards.current = new Set(snapshot.myCards.map((card) => card.id));
    if (!received) return;
    queueMicrotask(() => setDrawnCard(received));
  }, [snapshot.myCards]);

  async function action(path: string, body?: Record<string, unknown>) {
    setMessage("");
    try {
      const result = await runGameCommand(roomId, path, body);
      await onRefresh(result.revision ?? undefined);
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

  if (snapshot.room.status === "order_roll") return null;

  const visibleMessage = message || interaction.message;

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
          {game.playersById.get(snapshot.room.winnerPlayerId ?? "")?.factionName ??
            "uma facção"}
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
                setCardsOpen(true);
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
            {pendingConquest
              ? "Escolha as tropas para a conquista pendente."
              : battleBusy
                ? "Acompanhe a resolução do combate."
                : interaction.sourceId !== null
                  ? "Agora selecione um território inimigo destacado."
                  : "Selecione um território próprio com pelo menos 2 tropas."}
          </p>
          <button
            type="button"
            disabled={Boolean(pendingConquest) || battleBusy}
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
            {interaction.sourceId !== null
              ? "Escolha qualquer território próprio destacado."
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
              cardsOpen &&
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

      {cardsOpen ? (
        <GameModal
          eyebrow="Troca de cartas"
          title="Pedir reforços"
          className="game-card-modal w-full max-w-lg p-6"
          onClose={() => {
            setSelectedCards([]);
            setCardsOpen(false);
          }}
        >
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
                void action("cards/trade", { cardIds: selectedCards }).then(
                  (success) => {
                    if (!success) return;
                    setSelectedCards([]);
                    setCardsOpen(false);
                  },
                );
              }}
              className="game-primary-action rounded-xl bg-[#e4b94f] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#12392f] disabled:opacity-40"
            >
              Confirmar troca
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCards([]);
                setCardsOpen(false);
              }}
              className="game-secondary-action rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider"
            >
              Cancelar
            </button>
          </div>
        </GameModal>
      ) : null}

      {localDialog?.kind === "reinforce" && localTarget ? (
        <QuantityDialog
          key={`reinforce-${localDialog.targetId}`}
          mode="reinforce"
          max={snapshot.room.reinforcementsRemaining}
          target={localTarget}
          reinforcementRemaining={snapshot.room.reinforcementsRemaining}
          onCancel={interaction.clearDialog}
          onSubmit={async (troops) => {
            const success = await action("reinforce", {
              territoryId: localDialog.targetId,
              troops,
            });
            if (success) interaction.clearSelection();
            return success;
          }}
        />
      ) : null}

      {localDialog?.kind === "maneuver" && selectedSource && localTarget ? (
        <QuantityDialog
          key={`maneuver-${localDialog.sourceId}-${localDialog.targetId}-${localDialog.traversal.kind}`}
          mode="maneuver"
          max={maneuverMovableTroops(
            selectedSource.troops,
            selectedSource.movedInTurn,
          )}
          source={selectedSource}
          target={localTarget}
          maneuverTraversal={localDialog.traversal}
          reinforcementRemaining={snapshot.room.reinforcementsRemaining}
          onCancel={interaction.clearDialog}
          onSubmit={async (troops) => {
            const success = await action("maneuver", {
              fromTerritoryId: localDialog.sourceId,
              toTerritoryId: localDialog.targetId,
              troops,
            });
            if (success) interaction.clearSelection();
            return success;
          }}
        />
      ) : null}

      {isTurn && pendingConquest && !battleBusy && conquestSource && conquestTarget ? (
        <QuantityDialog
          key={`conquest-${pendingConquest.fromTerritoryId}-${pendingConquest.toTerritoryId}`}
          mode="conquest"
          max={Math.max(0, conquestSource.troops - 1)}
          source={conquestSource}
          target={conquestTarget}
          reinforcementRemaining={snapshot.room.reinforcementsRemaining}
          onSubmit={(troops) => action("conquest", { troops })}
        />
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

      {visibleMessage ? (
        <p
          className="mt-4 text-sm text-[#a33c33]"
          role="status"
          aria-live="polite"
        >
          {visibleMessage}
        </p>
      ) : null}
    </section>
  );
}

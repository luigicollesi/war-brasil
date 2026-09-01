"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import { useLobbySync } from "@/src/hooks/use-lobby-sync";

type LobbyClientProps = {
  code: string;
};

type RoomUpdateResponse = {
  room?: {
    id?: string;
    status?: "waiting" | "order_roll" | "playing";
  };
  error?: string;
};

type BotActionResponse = {
  error?: string;
};

type LobbyPendingAction =
  | "profile"
  | "ready"
  | "add-bot"
  | `remove-bot:${string}`
  | null;

type LobbyActionError = {
  scope: "profile" | "bot";
  message: string;
} | null;

function colorByValue(value: string) {
  return PLAYER_COLORS.find((color) => color.value === value);
}

export function LobbyClient({ code }: LobbyClientProps) {
  const router = useRouter();
  const { snapshot, error: syncError, isLoading, refresh } = useLobbySync(code);
  const [actionError, setActionError] = useState<LobbyActionError>(null);
  const [pendingAction, setPendingAction] = useState<LobbyPendingAction>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (snapshot && snapshot.room.status !== "waiting") {
      router.replace(`/game/${snapshot.room.id}`);
    }
  }, [router, snapshot]);

  async function updateMe(
    patch: Record<string, unknown>,
    action: "profile" | "ready" = "profile",
  ) {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction(action);

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/me`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as RoomUpdateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar suas escolhas.");
      }

      if (data.room?.status !== "waiting" && data.room?.id) {
        router.replace(`/game/${data.room.id}`);
        return;
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "profile",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível salvar suas escolhas.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function addBot() {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction("add-bot");

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/bots`, {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as BotActionResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível adicionar o bot.");
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "bot",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível adicionar o bot.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function removeBot(botId: string) {
    if (pendingAction !== null) return;
    setActionError(null);
    setPendingAction(`remove-bot:${botId}`);

    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/bots/${encodeURIComponent(botId)}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as BotActionResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível remover o bot.");
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: "bot",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível remover o bot.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(code.toUpperCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setActionError({
        scope: "profile",
        message: "Não foi possível copiar o código da sala.",
      });
    }
  }

  function saveFaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void updateMe({ factionName: formData.get("factionName") });
  }

  if (isLoading && !snapshot) {
    return (
      <div className="py-20 text-center">
        <p className="wb-kicker">Sala de comando</p>
        <p className="mt-3 text-sm text-[var(--wb-text-muted)]">Conectando à sala…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="py-20 text-center">
        <p className="wb-kicker">Sala indisponível</p>
        <p className="wb-error mt-3">{syncError || "Não foi possível encontrar esta sala."}</p>
      </div>
    );
  }

  const { me, players, room, canManageBots } = snapshot;
  const readyPlayers = players.filter((player) => player.isReady).length;
  const allReady = players.length >= 2 && readyPlayers === players.length;
  const emptySlots = Array.from({ length: Math.max(0, 6 - players.length) });
  const actionPending = pendingAction !== null;

  return (
    <>
      <section className="wb-lobby-heading">
        <div>
          <p className="wb-kicker">Sala de comando</p>
          <h1 className="mt-2 wb-display text-4xl leading-none sm:text-5xl">
            Preparar operação
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--wb-text-muted)]">
            Defina sua facção, acompanhe os demais jogadores e marque-se como
            pronto quando estiver preparado para iniciar.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="wb-lobby-code">
            <span className="wb-code-value">{room.code.toUpperCase()}</span>
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              className="wb-button wb-button--ghost"
              aria-label={`Copiar código da sala ${room.code.toUpperCase()}`}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center gap-4">
            {copied ? <span className="wb-copy-feedback">Código copiado</span> : null}
            <span className="wb-status">
              <span className="wb-status-dot" aria-hidden="true" />
              Sala sincronizada
            </span>
          </div>
        </div>
      </section>

      {syncError ? (
        <p className="wb-error mt-4" role="alert">
          {syncError}
        </p>
      ) : null}

      <div className="wb-lobby-grid">
        <section className="wb-lobby-region" aria-labelledby="lobby-players-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="lobby-players-title" className="wb-section-title">
              Jogadores
            </h2>
            <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--wb-text-muted)]">
              {players.length}/6
            </span>
          </div>

          <ul className="wb-player-list">
            {players.map((player, index) => (
              <PlayerRow
                key={player.id}
                player={player}
                index={index + 1}
                canManageBots={canManageBots}
                isRemoving={pendingAction === `remove-bot:${player.id}`}
                actionPending={actionPending}
                onRemoveBot={removeBot}
              />
            ))}
            {emptySlots.map((_, index) => {
              const isNextBotSlot = canManageBots && index === 0;
              return (
                <li
                  key={`empty-${index}`}
                  className={`wb-player-row${isNextBotSlot ? "" : " wb-empty-player"}`}
                >
                  <span className="wb-player-state">
                    {String(players.length + index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="wb-player-name">Aguardando jogador</p>
                    <p className="wb-player-meta">Vaga disponível</p>
                  </div>
                  {isNextBotSlot ? (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void addBot()}
                      className="wb-button wb-button--ghost px-2 py-1 text-[10px]"
                      aria-label="Adicionar bot na próxima vaga"
                    >
                      {pendingAction === "add-bot" ? "Adicionando…" : "+ Bot"}
                    </button>
                  ) : (
                    <span className="wb-player-state">○</span>
                  )}
                </li>
              );
            })}
          </ul>

          {actionError?.scope === "bot" ? (
            <p className="wb-error mt-3" role="alert">
              {actionError.message}
            </p>
          ) : null}
        </section>

        <section className="wb-lobby-region" aria-labelledby="lobby-map-title">
          <div className="wb-lobby-map">
            <p className="wb-section-title">Campo da operação</p>
            <h2 id="lobby-map-title" className="mt-2 wb-display text-3xl">
              Brasil
            </h2>
            <Image
              src="/war-brasil-42.production.svg"
              alt="Mapa da partida com 42 territórios"
              width={1254}
              height={1254}
              priority
            />
            <div className="wb-lobby-map-facts">
              <span>42 territórios</span>
              <span className="wb-diamond" aria-hidden="true" />
              <span>5 regiões</span>
            </div>
          </div>
        </section>

        <aside className="wb-lobby-region" aria-labelledby="my-faction-title">
          <h2 id="my-faction-title" className="wb-section-title">
            Sua facção
          </h2>

          <form onSubmit={saveFaction} className="wb-faction-editor">
            <label htmlFor="faction-name" className="wb-label">
              Nome
            </label>
            <div className="flex gap-2">
              <input
                id="faction-name"
                name="factionName"
                key={me.factionName}
                defaultValue={me.factionName}
                maxLength={32}
                disabled={actionPending}
                className="wb-field min-w-0 flex-1"
              />
              <button
                type="submit"
                disabled={actionPending}
                className="wb-button wb-button--ghost px-2"
                aria-label="Salvar nome da facção"
              >
                Salvar
              </button>
            </div>
          </form>

          <div className="wb-faction-editor">
            <p className="wb-label">Cor da facção</p>
            <div className="wb-color-grid">
              {PLAYER_COLORS.map((color) => {
                const takenByAnotherPlayer = players.some(
                  (player) => !player.isMe && player.color === color.value,
                );
                const isCurrentColor = me.color === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    title={
                      takenByAnotherPlayer
                        ? `${color.label} indisponível`
                        : isCurrentColor
                          ? `${color.label} selecionado`
                          : color.label
                    }
                    aria-label={
                      takenByAnotherPlayer
                        ? `${color.label}, indisponível`
                        : `${color.label}${isCurrentColor ? ", selecionado" : ""}`
                    }
                    disabled={actionPending || takenByAnotherPlayer || isCurrentColor}
                    onClick={() => void updateMe({ color: color.value })}
                    className="wb-color-choice"
                    data-selected={isCurrentColor ? "true" : "false"}
                  >
                    <span
                      className="wb-color-swatch"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden="true"
                    />
                    {isCurrentColor ? (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--wb-gold)] text-[9px] font-black text-[var(--wb-text-dark)]">
                        ✓
                      </span>
                    ) : takenByAnotherPlayer ? (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black/55 text-[9px] text-white">
                        ×
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--wb-text-muted)]">
              Alterar nome ou cor remove seu status de pronto.
            </p>
          </div>

          {actionError?.scope === "profile" ? (
            <p className="wb-error mt-5" role="alert">
              {actionError.message}
            </p>
          ) : null}
        </aside>
      </div>

      <section className="wb-ready-rail" aria-label="Preparação da partida">
        <div className="wb-shell-inner wb-ready-inner">
          <div className="wb-ready-progress">
            <div>
              <p className="wb-section-title">
                {allReady ? "Todos prontos" : `${readyPlayers} de ${players.length} prontos`}
              </p>
              <div className="wb-ready-progress-dots mt-2" aria-hidden="true">
                {players.map((player) => (
                  <span key={player.id} data-ready={player.isReady ? "true" : "false"} />
                ))}
              </div>
            </div>
            {allReady ? (
              <span className="wb-status ml-auto sm:ml-2">
                <span className="wb-diamond" aria-hidden="true" />
                Preparando tabuleiro
              </span>
            ) : null}
          </div>

          <button
            type="button"
            disabled={actionPending || allReady}
            onClick={() => void updateMe({ isReady: !me.isReady }, "ready")}
            className={`wb-button ${me.isReady ? "wb-button--secondary" : "wb-button--primary"}`}
          >
            {!me.isReady ? <span className="wb-diamond" aria-hidden="true" /> : null}
            {allReady
              ? "Preparando…"
              : me.isReady
                ? "Cancelar pronto"
                : "Pronto para batalha"}
          </button>
        </div>
      </section>
    </>
  );
}

function PlayerRow({
  player,
  index,
  canManageBots,
  isRemoving,
  actionPending,
  onRemoveBot,
}: {
  player: LobbyPlayer;
  index: number;
  canManageBots: boolean;
  isRemoving: boolean;
  actionPending: boolean;
  onRemoveBot: (botId: string) => Promise<void>;
}) {
  const color = colorByValue(player.color);

  return (
    <li className="wb-player-row" data-me={player.isMe ? "true" : "false"}>
      <span className="wb-player-state">{String(index).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="wb-player-color"
            style={{ backgroundColor: color?.hex }}
            aria-hidden="true"
          />
          <p className="wb-player-name">
            {player.factionName}
            {player.isMe ? " · você" : ""}
          </p>
        </div>
        <p className="wb-player-meta">
          {color?.label ?? "Facção"}{player.isBot ? " · BOT" : ""}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="wb-player-state" data-ready={player.isReady ? "true" : "false"}>
          {player.isReady ? "✓ Pronto" : "• Preparando"}
        </span>
        {player.isBot && canManageBots ? (
          <button
            type="button"
            disabled={actionPending}
            onClick={() => void onRemoveBot(player.id)}
            className="wb-button wb-button--ghost px-2 py-1 text-[10px]"
            aria-label={`Remover bot ${player.factionName}`}
          >
            {isRemoving ? "Removendo…" : "Remover"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

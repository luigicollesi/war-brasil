"use client";

import Image from "next/image";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import { useLobbySync } from "@/src/hooks/use-lobby-sync";
import styles from "./lobby-client.module.css";

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
  scope: "profile" | "ready" | "bot" | "copy";
  message: string;
} | null;

function colorByValue(value: string) {
  return PLAYER_COLORS.find((color) => color.value === value);
}

function stationStyle(color: string | undefined) {
  return {
    "--station-color": color ?? "#62776c",
  } as CSSProperties;
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
        throw new Error(
          data.error ??
            (action === "ready"
              ? "Não foi possível atualizar sua prontidão."
              : "Não foi possível salvar suas escolhas."),
        );
      }

      if (data.room?.status !== "waiting" && data.room?.id) {
        router.replace(`/game/${data.room.id}`);
        return;
      }

      await refresh();
    } catch (requestError) {
      setActionError({
        scope: action,
        message:
          requestError instanceof Error
            ? requestError.message
            : action === "ready"
              ? "Não foi possível atualizar sua prontidão."
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
    setActionError(null);

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API indisponível");
      }

      await navigator.clipboard.writeText(code.toUpperCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setActionError({
        scope: "copy",
        message:
          "Cópia automática indisponível. Selecione o código acima e copie manualmente.",
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
      <div className={styles.loadingState} aria-live="polite" aria-busy="true">
        <div className={styles.stateMachine}>
          <div className={styles.stateGlyph} aria-hidden="true" />
          <p className="wb-kicker">Canal de comando</p>
          <h1 className={styles.stateTitle}>Estabelecendo briefing</h1>
          <p className={styles.stateText}>
            Sincronizando a sala, os postos de comando e o estado de preparação.
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className={styles.fatalState}>
        <div className={styles.stateMachine}>
          <div className={styles.stateGlyph} aria-hidden="true" />
          <p className="wb-kicker">Canal indisponível</p>
          <h1 className={styles.stateTitle}>Briefing interrompido</h1>
          <p className={styles.stateText} role="alert">
            {syncError || "Não foi possível encontrar esta sala."}
          </p>
          <button
            type="button"
            className={`wb-button wb-button--secondary ${styles.retryButton}`}
            onClick={() => void refresh()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { me, players, room, canManageBots } = snapshot;
  const readyPlayers = players.filter((player) => player.isReady).length;
  const allReady = players.length >= 2 && readyPlayers === players.length;
  const emptySlots = Array.from({ length: Math.max(0, 6 - players.length) });
  const actionPending = pendingAction !== null;
  const readyPending = pendingAction === "ready";
  const roomCode = room.code.toUpperCase();
  const reconnecting = Boolean(syncError);
  const startAuthorized = room.status !== "waiting";
  const copyError = actionError?.scope === "copy" ? actionError.message : null;
  const readyError = actionError?.scope === "ready" ? actionError.message : null;
  const tableStatus = startAuthorized
    ? "CONFLITO AUTORIZADO"
    : allReady
      ? "Validação final de comando"
      : "Briefing em formação";

  return (
    <div
      className={`${styles.lobby} max-sm:flex max-sm:flex-col`}
      data-connection-state={reconnecting ? "reconnecting" : "connected"}
      data-start-authorized={startAuthorized ? "true" : "false"}
    >
      <header className={`wb-lobby-heading ${styles.masthead} max-sm:order-1`}>
        <div>
          <p className="wb-kicker">Briefing de alto comando</p>
          <h1 className={styles.title}>Conselho de operação</h1>
          <p className={styles.lead}>
            Cada facção ocupa um posto ao redor da Mesa de Domínio. Configure sua
            identidade, acompanhe a formação e confirme prontidão quando o comando
            estiver preparado.
          </p>
        </div>

        <div className={styles.operationIdentity}>
          <div>
            <p className={styles.codeLabel}>Código da operação</p>
            <div className={`wb-lobby-code ${styles.codeLine}`}>
              <code className={`wb-code-value ${styles.roomCode}`}>{roomCode}</code>
              <button
                type="button"
                onClick={() => void copyRoomCode()}
                className="wb-button wb-button--ghost"
                aria-label={`Copiar código da sala ${roomCode}`}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p
              className={`mt-1 max-w-sm text-[10px] leading-4 ${copyError ? "text-[#f4aaa0]" : "text-[var(--wb-text-muted)]"}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {copied
                ? `Código ${roomCode} copiado.`
                : copyError ??
                  "Compartilhe este código para convocar outros comandos."}
            </p>
          </div>

          <div
            className={styles.connection}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.connectionLamp} aria-hidden="true" />
            {reconnecting ? "Reconectando ao comando" : "Sala sincronizada"}
          </div>
        </div>
      </header>

      {syncError ? (
        <div
          className={`${styles.networkNotice} max-sm:order-2`}
          role="status"
          aria-live="polite"
        >
          <span>
            Conexão instável. A última formação confirmada permanece visível enquanto
            novas tentativas de sincronização acontecem automaticamente.
          </span>
          <button
            type="button"
            className="wb-button wb-button--ghost"
            onClick={() => void refresh()}
          >
            Sincronizar agora
          </button>
        </div>
      ) : null}

      <section
        className={`${styles.briefingStage} max-sm:order-4`}
        aria-labelledby="lobby-stations-title"
        data-all-ready={allReady ? "true" : "false"}
        data-start-authorized={startAuthorized ? "true" : "false"}
      >
        <h2 id="lobby-stations-title" className={styles.stageLegend}>
          {players.length}/6 postos ocupados
        </h2>

        <div className={`wb-lobby-map ${styles.domainTable}`}>
          <div className={styles.tableCore}>
            <p className={styles.tableEyebrow}>Mesa de Domínio</p>
            <div className={styles.mapWrap}>
              <Image
                src="/war-brasil-42.production.svg"
                alt="Brasil com os 42 territórios canônicos da partida"
                width={1254}
                height={1254}
                priority
                className={styles.mapImage}
              />
            </div>
            <div className={styles.tableReadout} aria-hidden="true">
              <strong>42 territórios</strong>
              <span>•</span>
              <span>
                {readyPlayers}/{players.length} comandos prontos
              </span>
            </div>
          </div>
          <p className={styles.authorization} role="status" aria-live="polite">
            {tableStatus}
          </p>
        </div>

        <ol className={styles.stationField} aria-label="Postos de comando da sala">
          {players.map((player, index) => (
            <PlayerStation
              key={player.id}
              player={player}
              slot={index + 1}
              canManageBots={canManageBots}
              isRemoving={pendingAction === `remove-bot:${player.id}`}
              actionPending={actionPending}
              onRemoveBot={removeBot}
            />
          ))}

          {emptySlots.map((_, index) => {
            const isNextBotSlot = canManageBots && index === 0;
            const slot = players.length + index + 1;

            return (
              <li
                key={`empty-${index}`}
                className={`${styles.station} ${styles.stationEmpty}`}
                data-slot={slot}
              >
                <div className={styles.stationTopline}>
                  <span className={styles.stationNumber}>
                    POSTO {String(slot).padStart(2, "0")}
                  </span>
                  <span className="wb-player-state">LIVRE</span>
                </div>
                <div className={styles.stationBody}>
                  <span className={styles.insignia} aria-hidden="true" />
                  <div className={styles.stationIdentity}>
                    <p className={styles.stationName}>Aguardando jogador</p>
                    <p className={styles.stationMeta}>Vaga disponível</p>
                  </div>
                </div>
                <div className={styles.stationStatus}>
                  <span>Canal desocupado</span>
                  {isNextBotSlot ? (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void addBot()}
                      className={`wb-button wb-button--ghost ${styles.botAction}`}
                      aria-label="Adicionar bot na próxima vaga"
                    >
                      {pendingAction === "add-bot" ? "Adicionando…" : "+ Bot"}
                    </button>
                  ) : (
                    <span className={styles.stationStatusMark} aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className={`${styles.localConsole} max-sm:order-3`}
        aria-labelledby="my-faction-title"
        aria-busy={pendingAction === "profile"}
      >
        <div className={styles.consoleIntro}>
          <p className="wb-section-title">Sua estação</p>
          <h2 id="my-faction-title" className={styles.consoleTitle}>
            Insígnia de Comando
          </h2>
          <p className={styles.consoleStatus}>
            {me.isReady
              ? "Comando confirmado. Qualquer alteração de identidade revoga a prontidão."
              : "Defina sua identificação operacional antes de confirmar prontidão."}
          </p>
          {canManageBots ? (
            <p className={styles.consoleStatus}>
              Você controla a composição de bots desta sala.
            </p>
          ) : null}
        </div>

        <div className={styles.identityControls}>
          <form
            onSubmit={saveFaction}
            className={`wb-faction-editor ${styles.nameEditor}`}
          >
            <label htmlFor="faction-name" className="wb-label">
              Nome da facção
            </label>
            <div className={styles.nameLine}>
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
                className="wb-button wb-button--ghost"
                aria-label="Salvar nome da facção"
              >
                {pendingAction === "profile" ? "Confirmando…" : "Salvar"}
              </button>
            </div>
          </form>

          <fieldset
            className={`wb-faction-editor ${styles.colorEditor} min-w-0 border-0 p-0`}
          >
            <legend className="wb-label">Cor da facção</legend>
            <div className={`wb-color-grid ${styles.colorGrid}`}>
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
                    className={`wb-color-choice ${styles.colorChoice}`}
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
            <p className={styles.colorLegend}>
              {colorByValue(me.color)?.label ?? "Cor atual"} selecionado. Cores ocupadas
              permanecem indisponíveis. Alterar nome ou cor remove seu status de pronto.
            </p>
          </fieldset>
        </div>

        {actionError?.scope === "bot" ? (
          <p className="wb-error" role="alert">
            {actionError.message}
          </p>
        ) : null}

        {actionError?.scope === "profile" ? (
          <p className="wb-error" role="alert">
            {actionError.message}
          </p>
        ) : null}
      </section>

      <section
        className={`wb-ready-rail ${styles.readyRail} max-sm:order-5`}
        aria-label="Preparação da partida"
        aria-busy={readyPending}
      >
        <div className={`wb-shell-inner wb-ready-inner ${styles.readyInner}`}>
          <div className={`wb-ready-progress ${styles.readyCopy}`}>
            <span
              className={styles.readyInsignia}
              data-ready={me.isReady ? "true" : "false"}
              aria-hidden="true"
            />
            <div>
              <p
                className={`${styles.readyTitle}${startAuthorized ? ` ${styles.startAuthorized}` : ""}`}
                id="ready-status"
              >
                {startAuthorized
                  ? "CONFLITO AUTORIZADO"
                  : allReady
                    ? "Todos os comandos confirmados"
                    : me.isReady
                      ? "Seu comando está pronto"
                      : "Aguardando sua confirmação"}
              </p>
              <p className={styles.readyDetail} aria-live="polite">
                {readyPending
                  ? "Solicitação enviada · aguardando confirmação do servidor"
                  : startAuthorized
                    ? "Transferindo autoridade para o tabuleiro."
                    : `${readyPlayers} de ${players.length} prontos · estado confirmado pelo servidor`}
              </p>
              <div className="wb-ready-progress-dots mt-2" aria-hidden="true">
                {players.map((player) => (
                  <span
                    key={player.id}
                    data-ready={player.isReady ? "true" : "false"}
                  />
                ))}
              </div>
              {readyError ? (
                <p className="wb-error" role="alert">
                  {readyError}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            disabled={actionPending || allReady}
            onClick={() => void updateMe({ isReady: !me.isReady }, "ready")}
            className={`wb-button ${me.isReady ? "wb-button--secondary" : "wb-button--primary"}`}
            aria-pressed={me.isReady}
            aria-describedby="ready-status"
            aria-busy={readyPending}
          >
            {readyPending
              ? "Confirmando…"
              : allReady
                ? "Preparando…"
                : me.isReady
                  ? "Cancelar pronto"
                  : "Pronto para batalha"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PlayerStation({
  player,
  slot,
  canManageBots,
  isRemoving,
  actionPending,
  onRemoveBot,
}: {
  player: LobbyPlayer;
  slot: number;
  canManageBots: boolean;
  isRemoving: boolean;
  actionPending: boolean;
  onRemoveBot: (botId: string) => Promise<void>;
}) {
  const color = colorByValue(player.color);
  const localHost = player.isMe && canManageBots;

  return (
    <li
      className={styles.station}
      data-slot={slot}
      data-me={player.isMe ? "true" : "false"}
      data-ready={player.isReady ? "true" : "false"}
      style={stationStyle(color?.hex)}
    >
      <div className={styles.stationTopline}>
        <span className={styles.stationNumber}>
          POSTO {String(slot).padStart(2, "0")}
        </span>
        <span className="wb-player-state">
          {localHost
            ? "COMANDO"
            : player.isBot
              ? "BOT"
              : player.isMe
                ? "VOCÊ"
                : "ATIVO"}
        </span>
      </div>

      <div className={styles.stationBody}>
        <span className={styles.insignia} aria-hidden="true" />
        <div className={styles.stationIdentity}>
          <p className={styles.stationName}>{player.factionName}</p>
          <p className={styles.stationMeta}>
            {color?.label ?? "Facção"}
            {player.isBot
              ? " · unidade automatizada"
              : player.isMe
                ? " · sua estação"
                : ""}
          </p>
        </div>
      </div>

      <div className={styles.stationStatus}>
        <span>{player.isReady ? "✓ Pronto" : "• Configurando"}</span>
        {player.isBot && canManageBots ? (
          <button
            type="button"
            disabled={actionPending}
            onClick={() => void onRemoveBot(player.id)}
            className={`wb-button wb-button--ghost ${styles.botAction}`}
            aria-label={`Remover bot ${player.factionName}`}
          >
            {isRemoving ? "Removendo…" : "Remover"}
          </button>
        ) : (
          <span className={styles.stationStatusMark} aria-hidden="true" />
        )}
      </div>
    </li>
  );
}

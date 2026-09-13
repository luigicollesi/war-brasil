"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { PreGameBackButton } from "@/src/components/pre-game-back-button";
import type { LobbyPlayer } from "@/src/lib/lobby";
import { LobbyFormationPanel } from "./lobby-formation-panel";
import { LobbyReadyDock } from "./lobby-ready-dock";
import { LobbyStationPanel } from "./lobby-station-panel";
import styles from "./lobby-command-workspace.module.css";

type MobileLobbyPanel = "formation" | "station";

type LobbyCommandWorkspaceProps = {
  roomCode: string;
  players: LobbyPlayer[];
  me: LobbyPlayer;
  canManageBots: boolean;
  readyPlayers: number;
  allReady: boolean;
  startAuthorized: boolean;
  reconnecting: boolean;
  actionPending: boolean;
  readyPending: boolean;
  pendingAction: string | null;
  copied: boolean;
  copyError: string | null;
  consoleError: string | null;
  readyError: string | null;
  tableStatus: string;
  onCopyRoomCode: () => void;
  onRefresh: () => void;
  onSaveFaction: (event: FormEvent<HTMLFormElement>) => void;
  onColorChange: (color: string) => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => Promise<void>;
  onToggleReady: () => void;
};

export function LobbyCommandWorkspace({
  roomCode,
  players,
  me,
  canManageBots,
  readyPlayers,
  allReady,
  startAuthorized,
  reconnecting,
  actionPending,
  readyPending,
  pendingAction,
  copied,
  copyError,
  consoleError,
  readyError,
  tableStatus,
  onCopyRoomCode,
  onRefresh,
  onSaveFaction,
  onColorChange,
  onAddBot,
  onRemoveBot,
  onToggleReady,
}: LobbyCommandWorkspaceProps) {
  const [mobilePanel, setMobilePanel] = useState<MobileLobbyPanel>("station");

  return (
    <div
      className={styles.lobby}
      data-lobby-layout="war-table"
      data-connection-state={reconnecting ? "reconnecting" : "connected"}
      data-start-authorized={startAuthorized ? "true" : "false"}
      data-mobile-panel={mobilePanel}
    >
      <header className={styles.commandBar}>
        <PreGameBackButton href="/matchmaking" label="Voltar para Operações" />

        <div className={styles.commandHeading}>
          <p className="wb-kicker">Sala de guerra · comando de mobilização</p>
          <h1 className={styles.title}>Conselho de operação</h1>
        </div>

        <div className={styles.operationIdentity}>
          <p className={styles.codeLabel}>Chave da operação</p>
          <div className={styles.codeLine}>
            <code className={`${styles.roomCode} wb-code-value`}>{roomCode}</code>
            <button
              type="button"
              onClick={onCopyRoomCode}
              className={`wb-button wb-button--ghost ${styles.copyButton}`}
              aria-label={`Copiar código da sala ${roomCode}`}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p
            className={`${styles.codeFeedback}${copyError ? ` ${styles.errorText}` : ""}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {copied
              ? `Código ${roomCode} copiado.`
              : copyError ?? "Compartilhe o código para convocar outros comandos."}
          </p>
        </div>

        <div className={styles.commandStatus}>
          <span className={styles.phaseBadge}>MOBILIZAÇÃO // 00</span>
          <div className={styles.connection} role="status" aria-live="polite" aria-atomic="true">
            <span className={styles.connectionLamp} aria-hidden="true" />
            {reconnecting ? "Reconectando ao comando" : "Sala sincronizada"}
          </div>
          <p className={styles.occupancy}>
            <strong>{players.length}/6</strong> postos · <strong>{readyPlayers}</strong> prontos
          </p>
        </div>
      </header>

      {reconnecting ? (
        <div className={styles.networkNotice} role="status" aria-live="polite">
          <span>Conexão instável. Mantendo a última formação confirmada.</span>
          <button type="button" className="wb-button wb-button--ghost" onClick={onRefresh}>
            Sincronizar agora
          </button>
        </div>
      ) : null}

      <div className={styles.mobileSwitcher} role="tablist" aria-label="Painel da sala">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "formation"}
          aria-controls="lobby-formation-panel"
          onClick={() => setMobilePanel("formation")}
        >
          Formação
          <span>{players.length}/6</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "station"}
          aria-controls="lobby-station-panel"
          onClick={() => setMobilePanel("station")}
        >
          Sua estação
          <span>{me.isReady ? "Pronto" : "Configurar"}</span>
        </button>
      </div>

      <div className={styles.workspace}>
        <LobbyFormationPanel
          players={players}
          canManageBots={canManageBots}
          actionPending={actionPending}
          pendingAction={pendingAction}
          readyPlayers={readyPlayers}
          allReady={allReady}
          startAuthorized={startAuthorized}
          tableStatus={tableStatus}
          onAddBot={onAddBot}
          onRemoveBot={onRemoveBot}
        />
        <LobbyStationPanel
          players={players}
          me={me}
          canManageBots={canManageBots}
          actionPending={actionPending}
          pendingAction={pendingAction}
          consoleError={consoleError}
          onSaveFaction={onSaveFaction}
          onColorChange={onColorChange}
        />
      </div>

      <LobbyReadyDock
        players={players}
        me={me}
        readyPlayers={readyPlayers}
        allReady={allReady}
        startAuthorized={startAuthorized}
        actionPending={actionPending}
        readyPending={readyPending}
        readyError={readyError}
        onToggleReady={onToggleReady}
      />
    </div>
  );
}

import Image from "next/image";
import type { CSSProperties } from "react";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import styles from "./lobby-formation-panel.module.css";

type LobbyFormationPanelProps = {
  players: LobbyPlayer[];
  canManageBots: boolean;
  actionPending: boolean;
  pendingAction: string | null;
  readyPlayers: number;
  allReady: boolean;
  startAuthorized: boolean;
  tableStatus: string;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => Promise<void>;
};

function colorByValue(value: string) {
  return PLAYER_COLORS.find((color) => color.value === value);
}

function stationStyle(color: string | undefined) {
  return {
    "--station-color": color ?? "#62776c",
  } as CSSProperties;
}

export function LobbyFormationPanel({
  players,
  canManageBots,
  actionPending,
  pendingAction,
  readyPlayers,
  allReady,
  startAuthorized,
  tableStatus,
  onAddBot,
  onRemoveBot,
}: LobbyFormationPanelProps) {
  const emptySlots = Array.from({ length: Math.max(0, 6 - players.length) });

  return (
    <section
      id="lobby-formation-panel"
      className={styles.stage}
      aria-labelledby="lobby-stations-title"
      data-all-ready={allReady ? "true" : "false"}
      data-start-authorized={startAuthorized ? "true" : "false"}
    >
      <div className={styles.stageHeader}>
        <div>
          <p className={styles.stageEyebrow}>Mesa de guerra · teatro nacional</p>
          <h2 id="lobby-stations-title" className={styles.stageTitle}>
            {players.length}/6 postos ocupados
          </h2>
        </div>
        <p className={styles.authorization} role="status" aria-live="polite">
          {tableStatus} · {readyPlayers}/{players.length} comandos prontos
        </p>
      </div>

      <div className={styles.warTable} data-tactical-nexus="brasil">
        <div className={styles.tacticalNexus} aria-hidden="true">
          <span className={styles.nexusHalo} />
          <span className={styles.nexusOrbit} />
          <span className={styles.nexusOrbitInner} />
          <div className={styles.mapProjector}>
            <Image
              src="/war-brasil-42.production.svg"
              alt=""
              fill
              sizes="(max-width: 720px) 1px, 300px"
              className={styles.brazilMap}
            />
            <span className={styles.mapScan} />
          </div>
          <div className={styles.nexusReadout}>
            <span>TEATRO // BRASIL</span>
            <strong>{startAuthorized ? "AUTORIZADO" : `${readyPlayers}/${players.length} SINCRONIZADOS`}</strong>
          </div>
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
              onRemoveBot={onRemoveBot}
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
                  <span className={styles.stationNumber}>POSTO {String(slot).padStart(2, "0")}</span>
                  <span className="wb-player-state">LIVRE</span>
                </div>
                <div className={styles.stationBody}>
                  <span className={styles.insignia} aria-hidden="true" />
                  <div className={styles.stationIdentity}>
                    <p className={styles.stationName}>Canal disponível</p>
                    <p className={styles.stationMeta}>Aguardando novo comando</p>
                  </div>
                </div>
                <div className={styles.stationStatus}>
                  <span>Sem assinatura</span>
                  {isNextBotSlot ? (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={onAddBot}
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
      </div>
    </section>
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
        <span className={styles.stationNumber}>POSTO {String(slot).padStart(2, "0")}</span>
        <span className="wb-player-state">
          {localHost ? "COMANDO" : player.isBot ? "BOT" : player.isMe ? "VOCÊ" : "ATIVO"}
        </span>
      </div>

      <div className={styles.stationBody}>
        <span className={styles.insignia} aria-hidden="true" />
        <div className={styles.stationIdentity}>
          <p className={styles.stationName}>{player.factionName}</p>
          <p className={styles.stationMeta}>
            {color?.label ?? "Facção"}
            {player.isBot ? " · unidade automatizada" : player.isMe ? " · sua estação" : ""}
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

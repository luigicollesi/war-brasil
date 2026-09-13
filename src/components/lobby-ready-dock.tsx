import type { LobbyPlayer } from "@/src/lib/lobby";
import styles from "./lobby-ready-dock.module.css";

type LobbyReadyDockProps = {
  players: LobbyPlayer[];
  me: LobbyPlayer;
  readyPlayers: number;
  allReady: boolean;
  startAuthorized: boolean;
  actionPending: boolean;
  readyPending: boolean;
  readyError: string | null;
  onToggleReady: () => void;
};

export function LobbyReadyDock({
  players,
  me,
  readyPlayers,
  allReady,
  startAuthorized,
  actionPending,
  readyPending,
  readyError,
  onToggleReady,
}: LobbyReadyDockProps) {
  const title = startAuthorized
    ? "CONFLITO AUTORIZADO"
    : readyPending
      ? me.isReady
        ? "Revogando confirmação"
        : "Solicitando confirmação"
      : allReady
        ? "Todos os comandos confirmados"
        : me.isReady
          ? "Seu comando está pronto"
          : "Aguardando sua confirmação";

  const detail = readyError
    ? readyError
    : startAuthorized
      ? "Transferindo autoridade para o tabuleiro."
      : readyPending
        ? `${readyPlayers} de ${players.length} prontos · aguardando servidor`
        : `${readyPlayers} de ${players.length} prontos · estado confirmado`;

  const authorizationSlots = Array.from({ length: 6 }, (_, index) => {
    const player = players[index];
    const state = !player ? "empty" : player.isReady ? "ready" : "configuring";
    return { player, state, slot: index + 1 };
  });

  return (
    <section
      className={styles.dock}
      aria-label="Preparação da partida"
      aria-busy={readyPending}
      data-start-authorized={startAuthorized ? "true" : "false"}
    >
      <div className={styles.readyCopy}>
        <span
          className={styles.readyInsignia}
          data-ready={me.isReady ? "true" : "false"}
          aria-hidden="true"
        />
        <div className={styles.readyText}>
          <p className={styles.railLabel}>PROTOCOLO // AUTORIZAÇÃO DE CONFLITO</p>
          <p
            id="ready-status"
            className={`${styles.readyTitle}${startAuthorized ? ` ${styles.startAuthorized}` : ""}`}
          >
            {title}
          </p>
          <p className={`${styles.readyDetail}${readyError ? ` ${styles.errorText}` : ""}`}>
            {detail}
          </p>
        </div>
      </div>

      <div className={styles.authorizationRail} aria-label={`${readyPlayers} de ${players.length} comandos prontos`}>
        {authorizationSlots.map(({ player, state, slot }) => (
          <span
            key={player?.id ?? `empty-${slot}`}
            className={styles.authorizationCell}
            data-state={state}
            title={player ? `${player.factionName}: ${player.isReady ? "pronto" : "configurando"}` : `Posto ${slot}: vazio`}
          >
            <small>{String(slot).padStart(2, "0")}</small>
            <i aria-hidden="true" />
          </span>
        ))}
      </div>

      <button
        type="button"
        disabled={actionPending || allReady}
        onClick={onToggleReady}
        className={`wb-button ${me.isReady ? "wb-button--secondary" : "wb-button--primary"} ${styles.readyButton}`}
        aria-pressed={me.isReady}
        aria-describedby="ready-status"
      >
        <span className={styles.buttonPrefix} aria-hidden="true">AUTH</span>
        <span>
          {readyPending
            ? "Confirmando…"
            : allReady
              ? "Preparando…"
              : me.isReady
                ? "Cancelar pronto"
                : "Pronto para batalha"}
        </span>
      </button>
    </section>
  );
}

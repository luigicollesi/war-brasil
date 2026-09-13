import type { FormEvent } from "react";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import styles from "./lobby-station-panel.module.css";

type LobbyStationPanelProps = {
  players: LobbyPlayer[];
  me: LobbyPlayer;
  canManageBots: boolean;
  actionPending: boolean;
  pendingAction: string | null;
  consoleError: string | null;
  onSaveFaction: (event: FormEvent<HTMLFormElement>) => void;
  onColorChange: (color: string) => void;
};

export function LobbyStationPanel({
  players,
  me,
  canManageBots,
  actionPending,
  pendingAction,
  consoleError,
  onSaveFaction,
  onColorChange,
}: LobbyStationPanelProps) {
  const currentColor = PLAYER_COLORS.find((color) => color.value === me.color);

  return (
    <section
      id="lobby-station-panel"
      className={styles.console}
      aria-labelledby="my-faction-title"
      aria-busy={pendingAction === "profile"}
    >
      <div className={styles.consoleIntro}>
        <p className="wb-section-title">Sua estação</p>
        <h2 id="my-faction-title" className={styles.consoleTitle}>Insígnia de Comando</h2>
        <p className={styles.consoleStatus}>
          {me.isReady
            ? "Comando confirmado. Alterar identidade revoga a prontidão."
            : "Defina sua identificação antes de confirmar prontidão."}
        </p>
        {canManageBots ? (
          <p className={styles.hostStatus}>Comando da sala · gerenciamento de bots ativo</p>
        ) : null}
      </div>

      <div className={styles.identityControls}>
        <form onSubmit={onSaveFaction} className={styles.nameEditor}>
          <label htmlFor="faction-name" className="wb-label">Nome da facção</label>
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
              className={`wb-button wb-button--ghost ${styles.saveButton}`}
            >
              {pendingAction === "profile" ? "Confirmando…" : "Salvar"}
            </button>
          </div>
        </form>

        <fieldset className={styles.colorEditor}>
          <legend className="wb-label">Cor da facção</legend>
          <div className={styles.colorGrid}>
            {PLAYER_COLORS.map((color) => {
              const occupied = players.some(
                (player) => !player.isMe && player.color === color.value,
              );
              const selected = me.color === color.value;

              return (
                <button
                  key={color.value}
                  type="button"
                  title={occupied ? `${color.label} indisponível` : color.label}
                  aria-label={
                    occupied
                      ? `${color.label}, indisponível`
                      : `${color.label}${selected ? ", selecionado" : ""}`
                  }
                  disabled={actionPending || occupied || selected}
                  onClick={() => onColorChange(color.value)}
                  className={styles.colorChoice}
                  data-selected={selected ? "true" : "false"}
                >
                  <span className={styles.colorSwatch} style={{ backgroundColor: color.hex }} />
                  {selected ? <span className={styles.colorMark}>✓</span> : null}
                  {occupied ? <span className={`${styles.colorMark} ${styles.colorMarkUnavailable}`}>×</span> : null}
                </button>
              );
            })}
          </div>
          <p className={styles.colorLegend}>
            {currentColor?.label ?? "Cor atual"} selecionado. Cores ocupadas ficam indisponíveis.
          </p>
        </fieldset>
      </div>

      <div className={styles.consoleFeedback} aria-live="polite">
        {consoleError ? (
          <p className={styles.errorText} role="alert">{consoleError}</p>
        ) : (
          <p>Alterar nome ou cor remove seu status de pronto.</p>
        )}
      </div>
    </section>
  );
}

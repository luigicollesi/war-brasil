import type { CSSProperties } from "react";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import styles from "./lobby-station-panel.module.css";

type LobbyStationPanelProps = {
  players: LobbyPlayer[];
  me: LobbyPlayer;
  canManageBots: boolean;
  actionPending: boolean;
  pendingAction: string | null;
  consoleError: string | null;
  onColorChange: (color: string) => void;
};

export function LobbyStationPanel({
  players,
  me,
  canManageBots,
  actionPending,
  pendingAction,
  consoleError,
  onColorChange,
}: LobbyStationPanelProps) {
  const currentColor = PLAYER_COLORS.find((color) => color.value === me.color);
  const commandMark =
    me.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "WB";
  const credentialStyle = {
    "--command-color": currentColor?.hex ?? "#d6a93e",
  } as CSSProperties;

  return (
    <section
      id="lobby-station-panel"
      className={styles.console}
      aria-labelledby="my-command-title"
      aria-busy={pendingAction === "profile"}
      style={credentialStyle}
    >
      <div className={styles.consoleIntro}>
        <div>
          <p className="wb-section-title">Sua estação</p>
          <h2 id="my-command-title" className={styles.consoleTitle}>Credencial de Comando</h2>
        </div>
        <span className={styles.clearance} data-ready={me.isReady ? "true" : "false"}>
          {me.isReady ? "NÍVEL // PRONTO" : "NÍVEL // CONFIGURAÇÃO"}
        </span>
      </div>

      <div className={styles.commandCredential} aria-label={`Credencial de comando de ${me.displayName}`}>
        <div className={styles.credentialSeal} aria-hidden="true">
          <span>{commandMark}</span>
        </div>
        <div className={styles.credentialIdentity}>
          <span className={styles.credentialLabel}>ASSINATURA TÁTICA</span>
          <strong className={styles.credentialName}>{me.displayName}</strong>
          {me.equippedTitle ? (
            <ProfileTitleRenderer
              title={me.equippedTitle}
              className={styles.credentialTitle}
            />
          ) : null}
          <span>
            {me.handle ? `@${me.handle} · ` : ""}
            {currentColor?.label ?? "Cor de comando"} · POSTO LOCAL
          </span>
        </div>
        <div className={styles.credentialTelemetry} aria-hidden="true">
          <span />
          <span />
          <span />
          <small>{canManageBots ? "HOST" : "LINK"}</small>
        </div>
      </div>

      <div className={styles.stationMessage}>
        <p className={styles.consoleStatus}>
          {me.isReady
            ? "Comando confirmado. Alterar a cor revoga a prontidão."
            : "A identidade vem do seu perfil. Escolha apenas a cor de comando."}
        </p>
        {canManageBots ? (
          <p className={styles.hostStatus}>Autoridade da sala · gerenciamento de bots ativo</p>
        ) : null}
      </div>

      <div className={styles.identityControls}>
        <div className={styles.displayIdentity}>
          <span className="wb-label">Nome de exibição</span>
          <div className={styles.displayIdentityValue}>
            <strong>{me.displayName}</strong>
            {me.handle ? <span>@{me.handle}</span> : null}
          </div>
        </div>

        <fieldset className={styles.colorEditor}>
          <legend className="wb-label">Cor de comando</legend>
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
                  className={`${styles.colorChoice} wb-color-choice`}
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
          <p>O nome vem do seu perfil. Alterar a cor remove seu status de pronto.</p>
        )}
      </div>
    </section>
  );
}

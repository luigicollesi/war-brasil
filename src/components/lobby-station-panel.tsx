import type { LobbyPlayer } from "@/src/lib/lobby";
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

export function LobbyStationPanel({ me }: LobbyStationPanelProps) {
  return (
    <section id="lobby-station-panel" className={styles.console}>
      <p className="wb-section-title">Sua estação</p>
      <h2>{me.factionName}</h2>
    </section>
  );
}

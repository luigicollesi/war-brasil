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

export function LobbyReadyDock({ me }: LobbyReadyDockProps) {
  return <section className={styles.dock}>{me.isReady ? "Pronto" : "Preparando"}</section>;
}

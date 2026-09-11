import type { ReactNode } from "react";
import { CommandShell } from "@/src/components/pre-game/foundation";
import styles from "./profile-command-shell.module.css";

export function ProfileCommandShell({ children }: { children: ReactNode }) {
  return (
    <CommandShell
      intent={{ mode: "profile", focus: "insignia", conflictLevel: 0 }}
      chrome={false}
      sectionLabel="Salão de Comando"
    >
      <div className={styles.frame}>{children}</div>
    </CommandShell>
  );
}

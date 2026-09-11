"use client";

import type { ReactNode } from "react";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import styles from "./profile-command-shell.module.css";

export function ProfileCommandShell({ children }: { children: ReactNode }) {
  useCommandSceneDirective({
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  });

  return <div className={styles.frame}>{children}</div>;
}

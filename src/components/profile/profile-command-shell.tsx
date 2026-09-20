"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import styles from "./profile-command-shell.module.css";

export function ProfileSceneBridge({ children }: { children: ReactNode }) {
  useCommandSceneDirective({
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  });

  return (
    <div className={styles.frame}>
      <nav className={styles.utilityNav} aria-label="Navegação do perfil">
        <Link href="/" className="wb-ghost-link">
          ← Início
        </Link>
        <Link href="/matchmaking" className="wb-ghost-link">
          Operações
        </Link>
      </nav>
      {children}
    </div>
  );
}

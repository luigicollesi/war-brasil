import type { Metadata } from "next";
import { OperationsConsole } from "@/src/components/operations-console";
import { WarShell } from "@/src/components/war-shell";
import styles from "./operations.module.css";

export const metadata: Metadata = {
  title: "Central de Operações",
  description: "Autorize uma nova operação ou localize uma sala existente no WAR Brasil.",
};

export default function MatchmakingPage() {
  return (
    <WarShell backHref="/" backLabel="Início" title="Central de Operações">
      <main className={`wb-shell-inner ${styles.page}`}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>MESA DE DOMÍNIO · MODO OPERACIONAL</p>
            <h1 className={styles.title}>Defina sua entrada no conflito.</h1>
          </div>
          <p className={styles.lead}>
            Autorize uma nova operação ou localize uma sala existente. Os dois
            protocolos operam na mesma estação de comando.
          </p>
        </header>

        <OperationsConsole />
      </main>
    </WarShell>
  );
}

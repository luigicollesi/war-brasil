import type { Metadata } from "next";
import Link from "next/link";
import { OperationsConsole } from "@/src/components/operations-console";
import styles from "./operations.module.css";

export const metadata: Metadata = {
  title: "Central de Operações",
  description: "Escolha como entrar no conflito: jogo clássico ou uma sala personalizada no WAR Brasil.",
};

export default function MatchmakingPage() {
  return (
    <main className={`wb-shell-inner ${styles.page}`}>
      <header className={styles.intro}>
        <Link href="/" className={styles.backLink}>
          <span aria-hidden="true">←</span>
          Início
        </Link>

        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>CENTRAL DE OPERAÇÕES · ENTRADA NO CONFLITO</p>
          <h1 className={styles.title}>Como você quer jogar?</h1>
        </div>

        <p className={styles.lead}>
          Escolha o protocolo de partida. Salas personalizadas já estão
          operacionais; o pareamento clássico será liberado em uma próxima fase.
        </p>
      </header>

      <OperationsConsole />
    </main>
  );
}

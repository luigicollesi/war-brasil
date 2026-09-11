import type { Metadata } from "next";
import Link from "next/link";
import {
  CommandShell,
  type CommandSceneIntent,
} from "@/src/components/pre-game/foundation";
import { OperationsConsole } from "@/src/components/operations-console";
import responsiveStyles from "./operations-responsive.module.css";
import styles from "./operations.module.css";
import foundationStyles from "./operations-foundation.module.css";

export const metadata: Metadata = {
  title: "Central de Operações",
  description: "Autorize uma nova operação ou localize uma sala existente no WAR Brasil.",
};

const OPERATIONS_SCENE_INTENT = {
  mode: "operations",
  focus: "brazil",
  conflictLevel: 0,
  territoryExplode: 0.08,
  orbitalAlignment: 0,
} as const satisfies CommandSceneIntent;

export default function MatchmakingPage() {
  return (
    <CommandShell
      intent={OPERATIONS_SCENE_INTENT}
      sectionLabel="CENTRAL DE OPERAÇÕES"
    >
      <main
        className={`wb-shell-inner ${styles.page} ${responsiveStyles.pageAdaptive} ${foundationStyles.foundationPage}`}
      >
        <Link href="/" className={foundationStyles.backLink}>
          <span aria-hidden="true">←</span>
          Início
        </Link>

        <header className={`${styles.intro} ${foundationStyles.foundationIntro}`}>
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
    </CommandShell>
  );
}

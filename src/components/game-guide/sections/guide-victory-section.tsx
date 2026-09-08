import Link from "next/link";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";

export function GuideVictorySection() {
  return (
    <article className="wb-guide-chapter wb-guide-victory wb-guide-section--victory">
      <div className="wb-guide-victory-copy">
        <p className="wb-kicker">15 · Vitória</p>
        <h2>Cumpra seu objetivo.</h2>
        <p>Assim que todas as condições forem cumpridas, a partida termina.</p>

        <GuideFlow
          compact
          ariaLabel="Fluxo para vencer a partida"
          className="wb-guide-victory-flow"
          steps={[
            { key: "mission", label: "Objetivo secreto" },
            { key: "condition", label: "Condição cumprida", tone: "accent" },
            { key: "victory", label: "Vitória", tone: "success" },
          ]}
        />
      </div>

      <div className="wb-guide-victory-side">
        <div className="wb-guide-victory-objective" aria-label="Objetivo secreto com todas as condições cumpridas">
          <small>◆ Objetivo secreto</small>
          <strong>Todas as condições cumpridas</strong>
          <span><b aria-hidden="true">✓</b> Condição do objetivo</span>
          <span><b aria-hidden="true">✓</b> Estado atual confirmado</span>
          <em>VITÓRIA</em>
        </div>

        <Link href="/matchmaking" className="wb-button wb-button--primary">
          <span className="wb-diamond" aria-hidden="true" />
          Jogar agora
        </Link>
      </div>
    </article>
  );
}

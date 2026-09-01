import Link from "next/link";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";

export function GuideVictorySection() {
  return (
    <article className="wb-guide-chapter wb-guide-victory wb-guide-section--victory">
      <div>
        <p className="wb-kicker">15 · Vitória</p>
        <h2>Cumpra sua missão antes dos rivais.</h2>
        <p>
          O jogo verifica seu objetivo sempre que uma mudança relevante altera
          tropas, territórios ou elimina um jogador. Assim que a condição é
          satisfeita, a partida termina.
        </p>

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

      <Link href="/matchmaking" className="wb-button wb-button--primary">
        <span className="wb-diamond" aria-hidden="true" />
        Jogar agora
      </Link>
    </article>
  );
}

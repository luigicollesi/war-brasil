import Image from "next/image";
import { GameDie } from "@/src/components/game-die";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import {
  GeographicBarrierMapExample,
} from "@/src/components/game-guide/guide-map-examples";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

function bandLabel(minimumTroops: number, maximumTroops: number | null) {
  if (maximumTroops === null) return `${minimumTroops}+ tropas`;
  return minimumTroops === maximumTroops
    ? `${minimumTroops} tropa${minimumTroops === 1 ? "" : "s"}`
    : `${minimumTroops}–${maximumTroops} tropas`;
}

function attackDice(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <GameDie key={index} value={5} color="ruby" size="sm" />
  ));
}

export function GuideBarrierSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-geographic-chapter wb-guide-section--barrier">
      <div className="wb-guide-geographic-intro">
        <div className="wb-guide-copy">
          <GuideHeading number="08" title="Cruze Barreiras Geográficas">
            Uma Barreira Geográfica mantém a comparação normal dos dados, mas
            aumenta o custo do ataque para quem atravessa. A defesa continua usando
            suas regras normais.
          </GuideHeading>

          <div className="wb-guide-notes">
            <p>
              <strong>Fronteira não é conexão normal.</strong> Uma Barreira pode
              existir entre territórios que se encostam no mapa e exige uma força
              maior para o ataque.
            </p>
            <p>
              <strong>A comparação não muda.</strong> Maior contra maior; empate
              continua favorecendo a defesa. O que muda é a quantidade de dados e
              a perda do atacante.
            </p>
          </div>
        </div>

        <div className="wb-guide-visual">
          <GeographicBarrierMapExample />
        </div>
      </div>

      <div className="wb-guide-barrier-comparison">
        <section>
          <p className="wb-guide-label">Ataque normal</p>
          <GuideRuleScale
            ariaLabel="Dados do ataque normal"
            items={guide.attack.normalDiceBands.map((band) => ({
              key: `${band.minimumTroops}-${band.maximumTroops ?? "plus"}`,
              label: bandLabel(band.minimumTroops, band.maximumTroops),
              value: attackDice(band.diceCount),
            }))}
          />
          <div className="wb-guide-barrier-loss">
            <small>Comparação perdida</small>
            <strong>−{guide.attack.normalLossPerComparison} tropa</strong>
          </div>
        </section>

        <div className="wb-guide-barrier-versus" aria-hidden="true">×</div>

        <section>
          <p className="wb-guide-label">Com Barreira</p>
          <GuideRuleScale
            ariaLabel="Dados do ataque atravessando Barreira Geográfica"
            items={guide.attack.barrierDiceBands.map((band) => ({
              key: `${band.minimumTroops}-${band.maximumTroops ?? "plus"}`,
              label: bandLabel(band.minimumTroops, band.maximumTroops),
              value: attackDice(band.diceCount),
              tone: "warning" as const,
            }))}
          />
          <div className="wb-guide-barrier-loss wb-guide-barrier-loss--danger">
            <small>Comparação perdida</small>
            <strong>−{guide.attack.barrierLossPerComparison} tropas</strong>
          </div>
        </section>
      </div>

      <div className="wb-guide-barrier-signals">
        <div>
          <Image src="/caveira-vermelha.svg" alt="" width={52} height={52} />
          <p>
            <strong>Caveira no ataque.</strong> Indica um alvo alcançável apenas
            atravessando Barreira Geográfica.
          </p>
        </div>
        <div>
          <Image src="/alcapao-saida.svg" alt="" width={52} height={52} />
          <p>
            <strong>Alçapão na manobra.</strong> Uma Barreira custa
            {` ${guide.maneuver.barrierLoss} tropa`} e exige pelo menos
            {` ${guide.maneuver.barrierMinimumTroops} tropas`}; com
            {` ${guide.maneuver.blockedBarrierCount}+ Barreiras`}, a rota fica
            bloqueada.
          </p>
        </div>
      </div>
    </article>
  );
}

import Link from "next/link";
import {
  AnomalyIcon,
  RoadsIcon,
  TroopsIcon,
} from "@/src/components/game-utility-icons";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { MapReadingExample } from "@/src/components/game-guide/guide-map-examples";
import { GuideAttackSection } from "@/src/components/game-guide/sections/guide-attack-section";
import { GuideBarrierSection } from "@/src/components/game-guide/sections/guide-barrier-section";
import { GuideCombatSection } from "@/src/components/game-guide/sections/guide-combat-section";
import { GuideConquestSection } from "@/src/components/game-guide/sections/guide-conquest-section";
import { GuideEliminationSection } from "@/src/components/game-guide/sections/guide-elimination-section";
import { GuideObjectiveSection } from "@/src/components/game-guide/sections/guide-objective-section";
import { GuideOrderSection } from "@/src/components/game-guide/sections/guide-order-section";
import { GuideReinforcementSection } from "@/src/components/game-guide/sections/guide-reinforcement-section";
import { GuideSetupSection } from "@/src/components/game-guide/sections/guide-setup-section";
import { GuideTurnSection } from "@/src/components/game-guide/sections/guide-turn-section";
import { Symbol } from "@/src/components/game-guide/guide-symbol";
import { UtilityDemo } from "@/src/components/game-guide/guide-utility-demo";
import { TemporalAnomalyEffectList } from "@/src/components/temporal-anomaly-effect-list";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";
import { buildGameGuidePresentation } from "@/src/lib/game-guide-presentation";

const anomalyExample: TemporalAnomalyPresentation["effects"] = [
  {
    kind: "troops-removed",
    label: "−2 tropas",
    primary: "São Paulo Oeste",
  },
  {
    kind: "attack-blocked",
    label: "Ataques bloqueados",
    primary: "Goiás",
  },
  {
    kind: "connection-opened",
    label: "Conexão aberta",
    primary: "Bahia Oeste-Sul ↔ Sergipe",
  },
  {
    kind: "barrier-moved",
    label: "Barreira reposicionada",
    primary: "Barreira geográfica",
    secondary: "Uma fronteira deixa de bloquear e outra passa a bloquear",
  },
];

export function GameQuickGuide() {
  const guide = buildGameGuidePresentation();

  return (
    <section id="manual" className="wb-guide" aria-labelledby="manual-title">
      <header className="wb-guide-intro">
        <p className="wb-kicker">Manual de campo</p>
        <h2 id="manual-title">Entenda uma partida em poucos minutos.</h2>
        <p>
          Aprenda a partida na ordem em que ela acontece. Cada seção explica uma
          decisão do jogo e usa o próprio mapa, dados e cartas para mostrar a regra.
        </p>
      </header>

      <GuideSetupSection guide={guide} />
      <GuideOrderSection />
      <GuideObjectiveSection />
      <GuideTurnSection />
      <GuideReinforcementSection guide={guide} />
      <GuideAttackSection guide={guide} />
      <GuideCombatSection guide={guide} />
      <GuideBarrierSection guide={guide} />
      <GuideConquestSection guide={guide} />
      <GuideEliminationSection />

      <article className="wb-guide-chapter wb-guide-chapter--split">
        <div className="wb-guide-copy">
          <GuideHeading number="11" title="Use suas cartas">
            Se você conquistar ao menos um território no turno, recebe uma carta ao
            final dele. Cartas podem ser trocadas por reforços cada vez maiores.
          </GuideHeading>

          <div className="wb-guide-card-rules">
            <div>
              <span>3 iguais</span>
              <div><Symbol src="/leaf.svg" alt="Folha" /><Symbol src="/leaf.svg" alt="Folha" /><Symbol src="/leaf.svg" alt="Folha" /><b>✓</b></div>
            </div>
            <div>
              <span>1 de cada</span>
              <div><Symbol src="/leaf.svg" alt="Folha" /><Symbol src="/water-drop.svg" alt="Água" /><Symbol src="/gold-bar.svg" alt="Ouro" /><b>✓</b></div>
            </div>
            <p>
              O <strong>Coringa</strong> substitui qualquer símbolo. A primeira troca
              vale +{guide.cards.firstTradeValue} reforços e as seguintes crescem em valor.
            </p>
            <p>
              Se uma carta trocada representa um território que você controla,
              esse território recebe <strong>+2 tropas</strong>.
            </p>
          </div>
        </div>

        <div className="wb-guide-visual wb-guide-card-preview">
          <figure>
            <TerritoryCardArtwork territoryId={18} symbol="gold" sizes="132px" />
            <figcaption>Carta de território</figcaption>
          </figure>
          <figure>
            <TerritoryCardArtwork territoryId={null} symbol="wild" sizes="132px" />
            <figcaption>Coringa</figcaption>
          </figure>
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-chapter--reverse">
        <div className="wb-guide-copy">
          <GuideHeading number="12" title="Leia o mapa">
            Estradas, contadores e destaques mostram como o tabuleiro pode ser usado
            naquele momento. Os controles permitem exibir apenas a informação que
            você quer consultar.
          </GuideHeading>

          <div className="wb-guide-controls">
            <UtilityDemo icon={<RoadsIcon />} label="Estradas">
              Mostra ou esconde as conexões normais entre os territórios.
            </UtilityDemo>
            <UtilityDemo icon={<TroopsIcon />} label="Tropas">
              Mostra ou esconde a quantidade de tropas em cada território.
            </UtilityDemo>
            <UtilityDemo icon={<AnomalyIcon />} label="Anomalia" anomaly>
              Reabre o evento da rodada para consultar seus efeitos.
            </UtilityDemo>
          </div>

          <p className="wb-guide-inline-note">
            <strong>Túnel Jurássico.</strong> A cada rodada, o Acre recebe uma
            conexão temporária com outro território. A ligação tracejada no mapa
            indica o destino atual e funciona como uma conexão enquanto estiver ativa.
          </p>
        </div>

        <div className="wb-guide-visual">
          <MapReadingExample />
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-chapter--reverse">
        <div className="wb-guide-copy">
          <GuideHeading number="13" title="Sobreviva às Anomalias">
            Quando todos jogam e uma nova rodada começa, uma Anomalia Temporal pode
            alterar as condições do tabuleiro: tropas, ataques, conexões e Barreiras
            Geográficas podem mudar.
          </GuideHeading>

          <p className="wb-guide-inline-note">
            A primeira Anomalia representa a tropa inicial: <strong>+1 tropa em
            todos os territórios</strong>. Por isso o mapa já começa com essa tropa.
          </p>
          <p className="wb-guide-inline-note">
            Depois disso, leia sempre o evento da rodada: ele pode fortalecer ou
            enfraquecer territórios, bloquear ataques, abrir ou fechar conexões e
            reposicionar Barreiras Geográficas.
          </p>
        </div>

        <div className="wb-guide-visual wb-guide-anomaly">
          <div className="wb-guide-anomaly-head">
            <span>◆</span>
            <div><small>Anomalia temporal</small><strong>Possíveis mudanças</strong></div>
          </div>
          <TemporalAnomalyEffectList
            effects={anomalyExample}
            heading="O que pode mudar"
            headingId="guide-anomaly-effects-heading"
            className="temporal-anomaly-effects wb-guide-anomaly-effects"
          />
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-victory">
        <div>
          <p className="wb-kicker">14 · Vitória</p>
          <h2>Cumpra seu objetivo antes dos rivais.</h2>
          <p>
            Assim que um jogador conclui seu objetivo secreto, a partida termina e
            o vencedor é declarado.
          </p>
        </div>
        <Link href="/matchmaking" className="wb-button wb-button--primary">
          <span className="wb-diamond" aria-hidden="true" />
          Jogar agora
        </Link>
      </article>
    </section>
  );
}

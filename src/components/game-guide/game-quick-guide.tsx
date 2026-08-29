import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { GameDie } from "@/src/components/game-die";
import {
  AnomalyIcon,
  RoadsIcon,
  TroopsIcon,
} from "@/src/components/game-utility-icons";
import {
  GeographicBarrierMapExample,
  MapReadingExample,
} from "@/src/components/game-guide/guide-map-examples";
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

const regionalStrategy = {
  nordeste:
    "Maior região do mapa: exige uma expansão ampla e é difícil manter todos os territórios.",
  norte:
    "Extensa, mas o domínio inclui o Acre e a vantagem estratégica do Túnel Jurássico.",
  sudeste:
    "Oito territórios muito disputados, com uma recompensa forte sem superar as grandes regiões.",
  "centro-oeste":
    "Poucos territórios, porém posição central e maior exposição tornam o domínio difícil de sustentar.",
  sul:
    "Compacta e periférica, tende a ser mais simples de consolidar e defender.",
} as const;

function GuideHeading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="wb-guide-heading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

function UtilityDemo({
  icon,
  label,
  children,
  anomaly = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  anomaly?: boolean;
}) {
  return (
    <figure className="wb-guide-control-demo">
      <div
        aria-hidden="true"
        className={`wb-guide-control ${anomaly ? "wb-guide-control--anomaly" : ""}`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <figcaption>{children}</figcaption>
    </figure>
  );
}

function Symbol({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="wb-guide-symbol">
      <Image src={src} alt={alt} width={28} height={28} />
    </span>
  );
}

export function GameQuickGuide() {
  const guide = buildGameGuidePresentation();

  return (
    <section id="manual" className="wb-guide" aria-labelledby="manual-title">
      <header className="wb-guide-intro">
        <p className="wb-kicker">Manual de campo</p>
        <h2 id="manual-title">Entenda uma partida em poucos minutos.</h2>
        <p>
          O essencial para começar: preparação, turno, barreiras geográficas,
          leitura do mapa, cartas, anomalias e vitória. O próprio jogo mostra os
          detalhes quando eles se tornam necessários.
        </p>
      </header>

      <article className="wb-guide-chapter wb-guide-chapter--split">
        <div className="wb-guide-copy">
          <GuideHeading number="01" title="Prepare o Brasil">
            Os {guide.territoryCount} territórios são embaralhados e distribuídos
            da forma mais equilibrada possível. Cada território começa com
            {` ${guide.setup.initialTroopsPerTerritory} tropa`} e cada jogador recebe
            um objetivo secreto.
          </GuideHeading>

          <div className="wb-guide-notes">
            <p>
              <strong>Objetivo secreto.</strong> Conquiste, fortifique, domine
              regiões ou elimine um rival. A sua missão define como você vence.
            </p>
            <p>
              <strong>Ordem de jogo.</strong> Cada jogador rola o dado. Os maiores
              resultados jogam primeiro; empates são decididos com novas rolagens.
            </p>
          </div>
        </div>

        <div className="wb-guide-visual wb-guide-setup-visual">
          <div className="wb-guide-map-mini">
            <Image
              src="/war-brasil-42.production.svg"
              alt="Mapa do Brasil dividido em territórios"
              width={440}
              height={440}
              loading="lazy"
            />
            <span>{guide.territoryCount} territórios</span>
            <small>{guide.regionCount} regiões</small>
          </div>
          <div className="wb-guide-objective" aria-label="Exemplo de objetivo secreto">
            <span>◆ Objetivo secreto</span>
            <strong>Domine antes dos rivais.</strong>
            <small>Só você conhece sua condição de vitória.</small>
          </div>
          <div className="wb-guide-order-roll" aria-label="Exemplo de sorteio da ordem">
            <div><GameDie value={6} color="forest" size="sm" /><span>1º</span></div>
            <div><GameDie value={4} color="ocean" size="sm" /><span>2º</span></div>
            <div><GameDie value={2} color="ruby" size="sm" /><span>3º</span></div>
          </div>
        </div>
      </article>

      <article className="wb-guide-chapter">
        <GuideHeading number="02" title="Jogue seu turno">
          O turno segue sempre a mesma leitura. Troque cartas quando quiser,
          posicione todos os reforços, ataque e então reorganize seu exército.
        </GuideHeading>

        <ol className="wb-guide-turn-flow" aria-label="Etapas do turno">
          <li><span>01</span><strong>Cartas</strong><small>opcional</small></li>
          <li><span>02</span><strong>Reforçar</strong><small>obrigatório</small></li>
          <li><span>03</span><strong>Atacar</strong><small>se quiser</small></li>
          <li><span>04</span><strong>Manobrar</strong><small>reposicione</small></li>
        </ol>

        <div className="wb-guide-rule-grid">
          <section>
            <p className="wb-guide-label">Reforços</p>
            <strong className="wb-guide-rule-number">
              {guide.reinforcement.territoryExample} territórios → +{guide.reinforcement.baseExample}
            </strong>
            <p>
              Você recebe metade dos territórios que controla, com mínimo de
              {` ${guide.reinforcement.minimum} tropas`}, além de bônus por regiões
              completas.
            </p>
          </section>

          <section>
            <p className="wb-guide-label">Combate</p>
            <div className="wb-guide-dice-versus" aria-label="Exemplo de comparação de dados">
              <div><GameDie value={6} color="ruby" size="sm" /><GameDie value={4} color="ruby" size="sm" /></div>
              <span>×</span>
              <div><GameDie value={5} color="ocean" size="sm" /><GameDie value={4} color="ocean" size="sm" /></div>
            </div>
            <p>
              Ataque um inimigo conectado. Os maiores dados são comparados entre
              si e <strong>empates favorecem a defesa</strong>. Pelo menos 1 tropa
              permanece na origem.
            </p>
          </section>

          <section>
            <p className="wb-guide-label">Manobra</p>
            <div className="wb-guide-route-chain" aria-label="Rota por territórios próprios">
              <span>A</span><i /><span>B</span><i /><span>C</span>
            </div>
            <p>
              Mova tropas entre territórios seus conectados. Uma cadeia própria
              permite mover de A até C usando B como passagem.
            </p>
          </section>
        </div>

        <section
          className="wb-guide-regional-domain"
          aria-labelledby="guide-regional-domain-title"
        >
          <div className="wb-guide-regional-heading">
            <div>
              <p className="wb-guide-label">Domínio regional</p>
              <h3 id="guide-regional-domain-title">
                Regiões completas aceleram seus reforços.
              </h3>
            </div>
            <p>
              <strong>O bônus é adicional ao reforço normal.</strong> Você o recebe
              em toda fase de reforço enquanto controlar todos os territórios da
              região.
            </p>
          </div>

          <div className="wb-guide-region-table-wrap">
            <table className="wb-guide-region-table">
              <thead>
                <tr>
                  <th scope="col">Região</th>
                  <th scope="col">Territórios</th>
                  <th scope="col">Bônus</th>
                  <th scope="col">Leitura estratégica</th>
                </tr>
              </thead>
              <tbody>
                {guide.regions.map((region) => (
                  <tr key={region.key} data-region={region.key}>
                    <th scope="row">
                      <span className="wb-guide-region-mark" aria-hidden="true" />
                      <span>{region.label}</span>
                    </th>
                    <td>
                      <strong>{region.territoryCount}</strong>
                      <small> territórios</small>
                    </td>
                    <td className="wb-guide-region-bonus">+{region.bonus}</td>
                    <td>{regionalStrategy[region.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="wb-guide-regional-note">
            <strong>O tamanho não é o único fator.</strong> Posição no mapa,
            exposição a ataques e vantagens especiais também pesam no valor de
            cada região.
          </p>
        </section>
      </article>

      <article className="wb-guide-chapter wb-guide-geographic-chapter">
        <div className="wb-guide-geographic-intro">
          <div className="wb-guide-copy">
            <GuideHeading number="03" title="Barreiras Geográficas">
              Nem toda fronteira entre dois territórios é uma conexão normal.
              Rios, serras, florestas e outros obstáculos podem transformar uma
              fronteira em uma Barreira Geográfica.
            </GuideHeading>

            <div className="wb-guide-notes">
              <p>
                <strong>Fronteira não é estrada.</strong> No exemplo real do Pará,
                Pará Oeste e Pará Sudeste dividem uma fronteira, mas ela está
                marcada como Barreira Geográfica. Já Pará Atlântico e Pará Sudeste
                possuem uma estrada e, portanto, uma conexão normal.
              </p>
              <p>
                <strong>Vantagem de quem defende.</strong> A barreira não dá dados
                extras à defesa. Ela coloca o atacante em Desvantagem Geográfica e
                torna a travessia de tropas mais custosa.
              </p>
            </div>
          </div>

          <div className="wb-guide-visual">
            <GeographicBarrierMapExample />
          </div>
        </div>

        <div className="wb-guide-geographic-actions">
          <section className="wb-guide-geographic-action wb-guide-geographic-action--attack">
            <div className="wb-guide-geographic-action-head">
              <span className="wb-guide-geographic-icon">
                <Image
                  src="/caveira-vermelha.svg"
                  alt="Caveira vermelha usada no mapa"
                  width={72}
                  height={72}
                />
              </span>
              <div>
                <p className="wb-guide-label">Ataque</p>
                <h3>Desvantagem Geográfica</h3>
              </div>
            </div>
            <p>
              Ao selecionar um território para atacar, a <strong>caveira</strong> 
               aparece sobre um inimigo alcançável somente através de uma Barreira
              Geográfica.
            </p>

            <div className="wb-guide-geographic-stats">
              <div><small>Para atacar</small><strong>mín. {guide.attack.barrierMinimumTroops} tropas</strong></div>
              <div><small>Comparação perdida</small><strong>−{guide.attack.barrierLossPerComparison} tropas</strong></div>
            </div>

            <div className="wb-guide-barrier-dice-bands" aria-label="Dados do ataque em Desvantagem Geográfica">
              {guide.attack.barrierDiceBands.map((band) => (
                <div key={band.minimumTroops}>
                  <span>
                    {band.maximumTroops === null
                      ? `${band.minimumTroops}+ tropas`
                      : `${band.minimumTroops}–${band.maximumTroops} tropas`}
                  </span>
                  <div>
                    {Array.from({ length: band.diceCount }, (_, index) => (
                      <GameDie key={index} value={5} color="ruby" size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <small className="wb-guide-geographic-footnote">
              A defesa continua com suas regras normais; a penalidade está no atacante.
            </small>
          </section>

          <section className="wb-guide-geographic-action wb-guide-geographic-action--maneuver">
            <div className="wb-guide-geographic-action-head">
              <span className="wb-guide-geographic-icon">
                <Image
                  src="/alcapao-saida.svg"
                  alt="Alçapão usado no mapa"
                  width={72}
                  height={72}
                />
              </span>
              <div>
                <p className="wb-guide-label">Manobra</p>
                <h3>Travessia Geográfica</h3>
              </div>
            </div>
            <p>
              Durante a manobra, o <strong>alçapão</strong> aparece sobre um
              território seu que pode ser alcançado atravessando uma Barreira
              Geográfica.
            </p>

            <div className="wb-guide-geographic-stats">
              <div><small>1 barreira</small><strong>−{guide.maneuver.barrierLoss} tropa</strong></div>
              <div><small>{guide.maneuver.blockedBarrierCount}+ barreiras</small><strong>rota bloqueada</strong></div>
            </div>

            <div className="wb-guide-geographic-route" aria-label="Exemplo de travessia de uma Barreira Geográfica">
              <span>A</span>
              <i />
              <Image src="/alcapao-saida.svg" alt="" width={42} height={42} />
              <i />
              <span>B</span>
            </div>

            <small className="wb-guide-geographic-footnote">
              Para atravessar uma barreira, pelo menos {guide.maneuver.barrierMinimumTroops} tropas precisam iniciar a movimentação.
            </small>
          </section>
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-chapter--reverse">
        <div className="wb-guide-copy">
          <GuideHeading number="04" title="Leia o mapa">
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

      <article className="wb-guide-chapter wb-guide-chapter--split">
        <div className="wb-guide-copy">
          <GuideHeading number="05" title="Use suas cartas">
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
          <GuideHeading number="06" title="Sobreviva às Anomalias">
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
          <p className="wb-kicker">07 · Vitória</p>
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

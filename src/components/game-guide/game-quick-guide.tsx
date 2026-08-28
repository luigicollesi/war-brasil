import Image from "next/image";
import Link from "next/link";
import { GameDie } from "@/src/components/game-die";
import {
  AnomalyIcon,
  RoadsIcon,
  TroopsIcon,
} from "@/src/components/game-utility-icons";
import { TemporalAnomalyEffectList } from "@/src/components/temporal-anomaly-effect-list";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import { buildGameGuidePresentation } from "@/src/lib/game-guide-presentation";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";

const anomalyExample: TemporalAnomalyPresentation["effects"] = [
  {
    kind: "troops-added",
    label: "+2 tropas",
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
];

function GuideHeading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
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
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
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
          O essencial para começar: preparação, turno, mapa, cartas, anomalias e
          vitória. O próprio jogo mostra os detalhes quando eles se tornam
          necessários.
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
      </article>

      <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-chapter--reverse">
        <div className="wb-guide-copy">
          <GuideHeading number="03" title="Leia o mapa">
            Três controles mantêm o tabuleiro limpo. Ative apenas a informação que
            você quer consultar naquele momento.
          </GuideHeading>

          <div className="wb-guide-controls">
            <UtilityDemo icon={<RoadsIcon />} label="Estradas">
              Mostra ou esconde as rotas acessíveis entre os territórios.
            </UtilityDemo>
            <UtilityDemo icon={<TroopsIcon />} label="Tropas">
              Mostra ou esconde a quantidade de tropas em cada território.
            </UtilityDemo>
            <UtilityDemo icon={<AnomalyIcon />} label="Anomalia" anomaly>
              Reabre o evento da rodada para consultar seus efeitos.
            </UtilityDemo>
          </div>
        </div>

        <div className="wb-guide-visual wb-guide-barrier-visual">
          <p className="wb-guide-label">Barreiras mudam o custo da rota</p>
          <div className="wb-guide-barrier-row">
            <strong>Normal</strong>
            <div className="wb-guide-barrier-line"><span /><i /><span /></div>
            <small>confronto perdido: −1 tropa</small>
          </div>
          <div className="wb-guide-barrier-row wb-guide-barrier-row--danger">
            <strong>Barreira</strong>
            <div className="wb-guide-barrier-line"><span /><i><b>▣</b></i><span /></div>
            <small>
              mínimo {guide.attack.barrierMinimumTroops} tropas · confronto perdido:
              −{guide.attack.barrierLossPerComparison}
            </small>
          </div>
          <div className="wb-guide-barrier-row wb-guide-barrier-row--warning">
            <strong>Manobra</strong>
            <div className="wb-guide-barrier-line"><span /><i><b>▣</b></i><span /></div>
            <small>
              atravessar custa {guide.maneuver.barrierLoss} tropa; com
              {` ${guide.maneuver.blockedBarrierCount} barreiras`} a rota é bloqueada
            </small>
          </div>
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-chapter--split">
        <div className="wb-guide-copy">
          <GuideHeading number="04" title="Use suas cartas">
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
          <GuideHeading number="05" title="Sobreviva às Anomalias">
            Quando todos jogam e uma nova rodada começa, uma Anomalia Temporal pode
            mudar tropas, ataques, conexões ou barreiras do mapa.
          </GuideHeading>

          <p className="wb-guide-inline-note">
            A primeira Anomalia representa a tropa inicial: <strong>+1 tropa em
            todos os territórios</strong>. Por isso o mapa já começa com essa tropa.
          </p>
          <p className="wb-guide-inline-note">
            O <strong>Túnel Jurássico</strong> cria uma ligação especial do Acre com
            outro território e muda de destino a cada nova rodada.
          </p>
        </div>

        <div className="wb-guide-visual wb-guide-anomaly">
          <div className="wb-guide-anomaly-head">
            <span>◆</span>
            <div><small>Anomalia temporal</small><strong>Exemplo de rodada</strong></div>
          </div>
          <TemporalAnomalyEffectList
            effects={anomalyExample}
            heading="O que mudou"
            headingId="guide-anomaly-effects-heading"
            className="temporal-anomaly-effects wb-guide-anomaly-effects"
          />
          <div className="wb-guide-tunnel" aria-label="Exemplo de conexão do Túnel Jurássico">
            <span>Acre</span><i /><b>🦖</b><i /><span>Destino</span>
          </div>
        </div>
      </article>

      <article className="wb-guide-chapter wb-guide-victory">
        <div>
          <p className="wb-kicker">06 · Vitória</p>
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

import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import {
  PLAYER_TRADE_OFFER_LIMIT,
  PLAYER_TRADE_SIGNAL_LIMIT,
} from "@/src/lib/shared/game-trade-rules";

export function GuideTurnSection() {
  return (
    <article className="wb-guide-chapter wb-guide-section--turn">
      <GuideHeading number="04" title="Siga seu turno">
        Seu turno segue sempre esta ordem.
      </GuideHeading>

      <GuideFlow
        ariaLabel="Etapas do turno"
        className="wb-guide-main-turn-flow"
        steps={[
          { key: "trade", eyebrow: "01", label: "Troca", detail: "opcional" },
          {
            key: "reinforcement",
            eyebrow: "02",
            label: "Reforços",
            detail: "obrigatório",
            tone: "accent",
          },
          { key: "attack", eyebrow: "03", label: "Ataques", detail: "opcional" },
          { key: "maneuver", eyebrow: "04", label: "Manobra", detail: "opcional" },
        ]}
      />

      <section className="wb-guide-player-trade" aria-labelledby="player-trade-title">
        <div className="wb-guide-player-trade-head">
          <div>
            <p className="wb-guide-label">Negociação entre jogadores</p>
            <h3 id="player-trade-title">Combine os termos antes de escolher a carta.</h3>
          </div>
          <p>
            O jogador da vez pode negociar com outro jogador humano ativo antes dos
            reforços. Bots não participam dessas negociações.
          </p>
        </div>

        <GuideFlow
          compact
          ariaLabel="Fluxo de negociação de cartas entre jogadores"
          className="wb-guide-player-trade-flow"
          steps={[
            { key: "offer", label: "Ofertar" },
            { key: "respond", label: "Responder" },
            { key: "terms", label: "Aceitar termos", tone: "accent" },
            { key: "select", label: "Escolher cartas" },
            { key: "swap", label: "Troca concluída" },
          ]}
        />

        <div className="wb-guide-player-trade-rules">
          <div>
            <span>01</span>
            <strong>Monte a proposta</strong>
            <p>
              Escolha quem recebe a oferta, o que você entrega e o que deseja. Os
              termos podem indicar um <b>território exato</b>, um <b>símbolo</b> ou
              um <b>coringa</b>. Você só pode oferecer algo compatível com sua mão.
            </p>
          </div>
          <div>
            <span>02</span>
            <strong>Negocie os termos</strong>
            <p>
              O alvo pode <b>aceitar</b>, <b>recusar</b> ou <b>contraofertar</b>. Se
              houver contraoferta, quem iniciou decide se aceita ou encerra a
              negociação.
            </p>
          </div>
          <div>
            <span>03</span>
            <strong>Entregue a carta</strong>
            <p>
              Depois do aceite, cada lado escolhe em privado uma carta que cumpra o
              termo combinado. As cartas só mudam de dono quando <b>ambos</b> fazem
              sua seleção.
            </p>
          </div>
        </div>

        <div className="wb-guide-player-trade-limits">
          <p>
            <strong>Até {PLAYER_TRADE_OFFER_LIMIT} ofertas iniciadas por turno.</strong>{" "}
            Só pode existir uma negociação ativa por vez; resolva ou cancele a atual
            antes de abrir outra ou seguir para os reforços.
          </p>
          <p>
            <strong>Notificar posse · até {PLAYER_TRADE_SIGNAL_LIMIT} vezes.</strong>{" "}
            Enquanto outro jogador está no turno, cada humano ativo pode sinalizar
            publicamente uma carta que possui. O aviso dura poucos segundos e não
            fica no histórico.
          </p>
        </div>

        <p className="wb-guide-inline-note wb-guide-player-trade-note">
          <strong>Negociação não gera tropas.</strong> Formar 3 cartas para receber
          reforços é outra regra e acontece na etapa de reforço, explicada mais adiante
          neste guia.
        </p>
      </section>

      <p className="wb-guide-turn-end">
        A fase de troca é opcional e pode ser encerrada quando não há negociação
        pendente. Depois da manobra, a vez passa para o próximo jogador ativo.
      </p>
    </article>
  );
}

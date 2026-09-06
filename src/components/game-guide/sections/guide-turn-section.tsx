import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideTurnSection({ guide }: { guide: GameGuidePresentation }) {
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

      <section
        className="wb-guide-player-trade mt-10 border-t border-[var(--wb-border-neutral)] pt-8 sm:mt-12 sm:pt-10"
        aria-labelledby="player-trade-title"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)] lg:items-end lg:gap-10">
          <div>
            <p className="wb-guide-label">Negociação entre jogadores</p>
            <h3
              id="player-trade-title"
              className="mt-2 max-w-2xl font-[var(--font-wb-display)] text-[clamp(1.7rem,3vw,2.45rem)] leading-none text-[var(--wb-text)]"
            >
              Combine os termos antes de escolher a carta.
            </h3>
          </div>
          <p className="text-sm leading-6 text-[var(--wb-text-muted)]">
            O jogador da vez pode negociar com outro jogador humano ativo antes dos
            reforços. Bots não participam dessas negociações.
          </p>
        </div>

        <GuideFlow
          compact
          ariaLabel="Fluxo de negociação de cartas entre jogadores"
          className="wb-guide-player-trade-flow mt-7"
          steps={[
            { key: "offer", label: "Ofertar" },
            { key: "respond", label: "Responder" },
            { key: "terms", label: "Aceitar termos", tone: "accent" },
            { key: "select", label: "Escolher cartas" },
            { key: "swap", label: "Troca concluída" },
          ]}
        />

        <div className="mt-7 grid overflow-hidden rounded-[var(--wb-radius-lg)] border border-[var(--wb-border-neutral)] md:grid-cols-3">
          <div className="p-5 md:p-6">
            <span className="text-[.68rem] font-black tracking-[.14em] text-[var(--wb-gold)]">
              01
            </span>
            <strong className="mt-2 block text-sm text-[var(--wb-text)]">
              Monte a proposta
            </strong>
            <p className="mt-2 text-xs leading-5 text-[var(--wb-text-muted)]">
              Escolha quem recebe a oferta, o que você entrega e o que deseja. Os
              termos podem indicar um <b>território exato</b>, um <b>símbolo</b> ou
              um <b>coringa</b>. Você só pode oferecer algo compatível com sua mão.
            </p>
          </div>
          <div className="border-t border-[var(--wb-border-neutral)] p-5 md:border-l md:border-t-0 md:p-6">
            <span className="text-[.68rem] font-black tracking-[.14em] text-[var(--wb-gold)]">
              02
            </span>
            <strong className="mt-2 block text-sm text-[var(--wb-text)]">
              Negocie os termos
            </strong>
            <p className="mt-2 text-xs leading-5 text-[var(--wb-text-muted)]">
              O alvo pode <b>aceitar</b>, <b>recusar</b> ou <b>contraofertar</b>. Se
              houver contraoferta, quem iniciou decide se aceita ou encerra a
              negociação.
            </p>
          </div>
          <div className="border-t border-[var(--wb-border-neutral)] p-5 md:border-l md:border-t-0 md:p-6">
            <span className="text-[.68rem] font-black tracking-[.14em] text-[var(--wb-gold)]">
              03
            </span>
            <strong className="mt-2 block text-sm text-[var(--wb-text)]">
              Entregue a carta
            </strong>
            <p className="mt-2 text-xs leading-5 text-[var(--wb-text-muted)]">
              Depois do aceite, cada lado escolhe em privado uma carta que cumpra o
              termo combinado. As cartas só mudam de dono quando <b>ambos</b> fazem
              sua seleção.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-[var(--wb-radius-lg)] border border-[rgba(214,169,62,.2)] bg-[rgba(214,169,62,.2)] md:grid-cols-2">
          <p className="bg-[rgba(7,30,24,.86)] p-5 text-sm leading-6 text-[var(--wb-text-muted)]">
            <strong className="text-[var(--wb-text)]">
              Até {guide.playerTrade.offerLimitPerTurn} ofertas iniciadas por turno.
            </strong>{" "}
            Só pode existir uma negociação ativa por vez; resolva ou cancele a atual
            antes de abrir outra ou seguir para os reforços.
          </p>
          <p className="bg-[rgba(7,30,24,.86)] p-5 text-sm leading-6 text-[var(--wb-text-muted)]">
            <strong className="text-[var(--wb-text)]">
              Notificar posse · até {guide.playerTrade.signalLimitPerTurn} vezes.
            </strong>{" "}
            Enquanto outro jogador está no turno, cada humano ativo pode sinalizar
            publicamente uma carta que possui. O aviso dura poucos segundos e não
            fica no histórico.
          </p>
        </div>

        <p className="wb-guide-inline-note mt-6">
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

import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideTradeScene } from "@/src/components/game-guide/guide-trade-scene";
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

      <section className="wb-guide-player-trade-layout" aria-labelledby="guide-player-trade-title">
        <div className="wb-guide-player-trade-copy">
          <p className="wb-guide-label">Negociação entre jogadores</p>
          <h3 id="guide-player-trade-title">Combine os termos antes de escolher a carta.</h3>
          <p>
            O jogador da vez pode negociar com outro jogador humano ativo antes dos
            reforços. Bots não participam dessas negociações. O alvo pode aceitar,
            recusar ou contraofertar.
          </p>

          <div className="wb-guide-player-trade-limits" aria-label="Limites da negociação">
            <div>
              <strong>{guide.playerTrade.offerLimitPerTurn}</strong>
              <span>ofertas iniciadas por turno</span>
            </div>
            <div>
              <strong>{guide.playerTrade.signalLimitPerTurn}</strong>
              <span>notificações de posse por humano fora da vez</span>
            </div>
          </div>
        </div>

        <GuideTradeScene />
      </section>

      <GuideFlow
        compact
        ariaLabel="Fluxo de negociação de cartas entre jogadores"
        className="wb-guide-player-trade-flow"
        steps={[
          { key: "offer", label: "Ofertar" },
          { key: "respond", label: "Responder" },
          { key: "terms", label: "Aceitar termos", tone: "accent" },
          { key: "select", label: "Escolher cartas" },
          { key: "swap", label: "Troca concluída", tone: "success" },
        ]}
      />

      <div className="wb-guide-scene-rule-row">
        <p>
          <strong>Uma negociação por vez.</strong> Resolva ou cancele a proposta atual
          antes de abrir outra ou seguir para os reforços.
        </p>
        <p>
          <strong>Notificar posse.</strong> Fora da vez, um humano ativo pode avisar
          publicamente que possui uma carta; o aviso é temporário e não vira histórico.
        </p>
      </div>

      <p className="wb-guide-inline-note">
        <strong>Negociação não gera tropas.</strong> Converter uma combinação de 3 cartas
        em reforços é outra regra, explicada na seção 11.
      </p>

      <p className="wb-guide-turn-end">
        A fase de troca é opcional e pode ser encerrada quando não há negociação
        pendente. Depois da manobra, a vez passa para o próximo jogador ativo.
      </p>
    </article>
  );
}

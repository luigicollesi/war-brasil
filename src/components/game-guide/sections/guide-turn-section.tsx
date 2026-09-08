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

      <section className="wb-guide-player-trade" aria-labelledby="player-trade-title">
        <div className="wb-guide-player-trade-heading">
          <div>
            <p className="wb-guide-label">Negociação entre jogadores</p>
            <h3 id="player-trade-title">Combine os termos antes de escolher a carta.</h3>
          </div>
          <p>
            O jogador da vez pode negociar com outro humano ativo antes dos reforços.
            O alvo pode aceitar, recusar ou contraofertar; bots não participam.
          </p>
        </div>

        <GuideTradeScene
          offerLimit={guide.playerTrade.offerLimitPerTurn}
          signalLimit={guide.playerTrade.signalLimitPerTurn}
        />

        <div className="wb-guide-player-trade-rules">
          <p>
            <strong>Termos públicos.</strong> A oferta pode pedir território específico,
            símbolo ou coringa. Depois do aceite, cada lado escolhe em privado uma carta
            compatível; a troca só conclui após as duas seleções.
          </p>
          <p>
            <strong>Notificar posse.</strong> Fora da própria vez, um humano pode avisar
            publicamente que possui uma carta disponível. O aviso é temporário e não
            fica no histórico.
          </p>
        </div>

        <p className="wb-guide-inline-note">
          <strong>Negociação não gera tropas.</strong> Converter uma combinação de 3
          cartas em reforços é outra regra, explicada na seção 11.
        </p>
      </section>

      <p className="wb-guide-turn-end">
        A fase de troca é opcional e só termina quando não há negociação pendente.
        Depois da manobra, a vez passa para o próximo jogador ativo.
      </p>
    </article>
  );
}

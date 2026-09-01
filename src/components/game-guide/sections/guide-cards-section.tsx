import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
import { Symbol } from "@/src/components/game-guide/guide-symbol";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideCardsSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-section--cards">
      <GuideHeading number="11" title="Transforme cartas em tropas">
        Conquistar ao menos um território no turno rende uma carta no encerramento.
        Durante o reforço, combine três cartas válidas para aumentar seu saldo de
        tropas.
      </GuideHeading>

      <GuideFlow
        compact
        ariaLabel="Como receber uma carta de território"
        className="wb-guide-card-reward-flow"
        steps={[
          { key: "conquer", label: "Conquistou ≥ 1" },
          { key: "finish", label: "Fim do turno" },
          {
            key: "draw",
            label: `+${guide.cards.cardsPerConqueringTurn} carta`,
            tone: "accent",
          },
        ]}
      />

      <div className="wb-guide-cards-layout">
        <section className="wb-guide-card-combinations">
          <div>
            <p className="wb-guide-label">Combinações válidas</p>
            <h3>Selecione exatamente três cartas.</h3>
          </div>

          <div className="wb-guide-card-combination-list">
            <div>
              <span>3 símbolos iguais</span>
              <div>
                <Symbol src="/leaf.svg" alt="Folha" />
                <Symbol src="/leaf.svg" alt="Folha" />
                <Symbol src="/leaf.svg" alt="Folha" />
                <b aria-label="Combinação válida">✓</b>
              </div>
            </div>
            <div>
              <span>1 de cada símbolo</span>
              <div>
                <Symbol src="/leaf.svg" alt="Folha" />
                <Symbol src="/water-drop.svg" alt="Água" />
                <Symbol src="/gold-bar.svg" alt="Ouro" />
                <b aria-label="Combinação válida">✓</b>
              </div>
            </div>
            <div>
              <span>Coringa substitui símbolo</span>
              <div className="wb-guide-wild-combination">
                <Symbol src="/leaf.svg" alt="Folha" />
                <Symbol src="/leaf.svg" alt="Folha" />
                <TerritoryCardArtwork
                  territoryId={null}
                  symbol="wild"
                  sizes="52px"
                  className="wb-guide-card-symbol-wild"
                />
                <b aria-label="Combinação válida">✓</b>
              </div>
            </div>
          </div>
          <small className="wb-guide-card-combination-note">
            Três Coringas também formam uma combinação válida.
          </small>
        </section>

        <section className="wb-guide-card-progress">
          <p className="wb-guide-label">Valor das suas trocas</p>
          <GuideRuleScale
            ariaLabel="Progressão pessoal de reforços por troca de cartas"
            items={guide.cards.tradeValues.map((value, index) => ({
              key: `trade-${index + 1}`,
              label: `${index + 1}ª troca`,
              value: `+${value} tropas`,
              tone: index === 0 ? "accent" : "default",
            }))}
          />
          <p>
            Depois disso, cada nova troca sua vale
            {` +${guide.cards.incrementPerPersonalTrade} tropa`} a mais que a anterior.
            A progressão é <strong>individual</strong>, não compartilhada com os rivais.
          </p>
        </section>
      </div>

      <div className="wb-guide-card-bonus-row">
        <div className="wb-guide-card-bonus-art" aria-hidden="true">
          <TerritoryCardArtwork territoryId={18} symbol="gold" sizes="104px" />
        </div>
        <div>
          <p className="wb-guide-label">Território correspondente</p>
          <strong>Controle o território da carta → +{guide.cards.ownedTerritoryBonus} tropas nele</strong>
          <small>
            O bônus é aplicado para cada carta territorial da troca que corresponda
            a um território sob seu controle.
          </small>
        </div>
      </div>

      <p className="wb-guide-inline-note wb-guide-card-mandatory-note">
        <strong>{guide.cards.mandatoryTradeHandSize} ou mais cartas na mão.</strong> A
        troca passa a ser obrigatória: você precisa formar uma combinação válida antes
        de posicionar reforços. Cartas recebidas de um jogador eliminado também entram
        na sua mão.
      </p>
    </article>
  );
}

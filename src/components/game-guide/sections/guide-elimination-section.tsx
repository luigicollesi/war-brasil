import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";

export function GuideEliminationSection() {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--elimination">
      <div className="wb-guide-copy">
        <GuideHeading number="10" title="Elimine jogadores">
          Conquiste o último território de um jogador para eliminá-lo. As cartas dele
          passam ao conquistador.
        </GuideHeading>

        <p className="wb-guide-inline-note">
          <strong>Fora da ordem.</strong> Jogadores eliminados deixam de receber
          turnos.
        </p>
      </div>

      <div className="wb-guide-visual wb-guide-elimination-visual">
        <GuideBoardScene
          compact
          ariaLabel="Exemplo no mapa 2D: o último território inimigo é conquistado"
          markers={[
            { key: "winner", label: "Conquistador", troops: 4, x: 44, y: 49, tone: "ally", selected: true },
            { key: "last", label: "Último território", troops: 1, x: 61, y: 53, tone: "enemy" },
          ]}
          arrows={[
            { key: "last-attack", from: { x: 46, y: 49 }, to: { x: 59, y: 52 }, kind: "attack", label: "último território" },
          ]}
          caption="Quando esse território cai, o rival fica com 0 territórios e sai da ordem de turnos."
        />

        <GuideFlow
          compact
          ariaLabel="Fluxo de eliminação de um jogador"
          className="wb-guide-elimination-flow"
          steps={[
            { key: "last", label: "Último território" },
            { key: "zero", label: "0 territórios", tone: "danger" },
            { key: "out", label: "Eliminado", tone: "danger" },
          ]}
        />

        <div className="wb-guide-elimination-transfer" aria-label="Cartas do eliminado passam ao conquistador">
          <div>
            <small>Mão do eliminado</small>
            <div className="wb-guide-elimination-cards" aria-hidden="true">
              <TerritoryCardArtwork territoryId={18} symbol="gold" sizes="82px" />
              <TerritoryCardArtwork territoryId={22} symbol="leaf" sizes="82px" />
              <TerritoryCardArtwork territoryId={31} symbol="water" sizes="82px" />
            </div>
          </div>
          <span aria-hidden="true">→</span>
          <strong>Passam ao conquistador</strong>
        </div>
      </div>
    </article>
  );
}

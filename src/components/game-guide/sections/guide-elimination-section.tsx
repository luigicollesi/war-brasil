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

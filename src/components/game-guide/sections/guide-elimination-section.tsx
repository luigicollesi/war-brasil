import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";

export function GuideEliminationSection() {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--elimination">
      <div className="wb-guide-copy">
        <GuideHeading number="10" title="Elimine um rival">
          Um jogador é eliminado quando perde seu último território. Quem realiza
          essa conquista recebe todas as cartas que estavam na mão do eliminado.
        </GuideHeading>

        <div className="wb-guide-notes">
          <p>
            <strong>Fora da ordem.</strong> O jogador eliminado deixa de receber
            turnos imediatamente.
          </p>
          <p>
            <strong>Missões são reavaliadas.</strong> Se alguém tinha aquele jogador
            como alvo de eliminação, o jogo verifica a missão mesmo quando outro
            jogador realizou a conquista final.
          </p>
        </div>
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

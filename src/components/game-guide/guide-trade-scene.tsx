import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";

function PlayerBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ally" | "enemy";
}) {
  return (
    <div className="wb-guide-trade-player" data-tone={tone}>
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

export function GuideTradeScene({
  offerLimit,
  signalLimit,
}: {
  offerLimit: number;
  signalLimit: number;
}) {
  return (
    <div className="wb-guide-trade-scene" aria-label="Exemplo visual de negociação de uma carta entre dois jogadores">
      <div className="wb-guide-trade-stage">
        <div className="wb-guide-trade-side">
          <PlayerBadge label="Você" tone="ally" />
          <div className="wb-guide-trade-card-wrap">
            <small>oferece</small>
            <TerritoryCardArtwork territoryId={18} symbol="gold" sizes="96px" />
          </div>
        </div>

        <div className="wb-guide-trade-center" aria-hidden="true">
          <span>proposta</span>
          <strong>⇄</strong>
          <small>aceite ou contraoferta</small>
        </div>

        <div className="wb-guide-trade-side wb-guide-trade-side--right">
          <PlayerBadge label="Outro jogador" tone="enemy" />
          <div className="wb-guide-trade-card-wrap">
            <small>em troca de</small>
            <TerritoryCardArtwork territoryId={31} symbol="water" sizes="96px" />
          </div>
        </div>
      </div>

      <div className="wb-guide-trade-completion">
        <div>
          <span>01</span>
          <strong>Termos aceitos</strong>
          <small>cada lado escolhe uma carta compatível</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>02</span>
          <strong>Seleções privadas</strong>
          <small>a outra carta não é revelada antes da escolha</small>
        </div>
        <i aria-hidden="true">→</i>
        <div data-tone="success">
          <span>03</span>
          <strong>Cartas trocadas</strong>
          <small>só depois das duas seleções</small>
        </div>
      </div>

      <div className="wb-guide-trade-limits">
        <p>
          <strong>{offerLimit} ofertas</strong>
          <span>máximo iniciadas por turno</span>
        </p>
        <p>
          <strong>{signalLimit} sinais</strong>
          <span>“Notificar posse” por humano e por turno</span>
        </p>
      </div>
    </div>
  );
}

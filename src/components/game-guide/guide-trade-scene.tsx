import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";

const tradeCardClassName =
  "wb-guide-trade-card relative aspect-[2/3] w-24 overflow-hidden rounded-xl bg-[#f9f4df]";

function GuideTradePlayer({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "ally" | "enemy";
}) {
  return (
    <div className="wb-guide-trade-player" data-tone={tone}>
      <span aria-hidden="true">{label.slice(0, 1)}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export function GuideTradeScene() {
  return (
    <figure className="wb-guide-trade-scene">
      <div
        className="wb-guide-trade-stage"
        role="img"
        aria-label="Exemplo visual de negociação: dois jogadores combinam símbolos, aceitam os termos, escolhem cartas compatíveis em privado e então trocam as cartas"
      >
        <div className="wb-guide-trade-players">
          <GuideTradePlayer label="Você" detail="jogador da vez" tone="ally" />
          <span className="wb-guide-trade-versus" aria-hidden="true">↔</span>
          <GuideTradePlayer label="Rival" detail="jogador humano" tone="enemy" />
        </div>

        <div className="wb-guide-trade-terms" aria-hidden="true">
          <div>
            <small>Você oferece</small>
            <strong>Símbolo ouro</strong>
          </div>
          <span>⇄</span>
          <div>
            <small>Você pede</small>
            <strong>Símbolo água</strong>
          </div>
        </div>

        <div className="wb-guide-trade-decisions" aria-hidden="true">
          <span data-tone="success">Aceitar</span>
          <span data-tone="accent">Contraofertar</span>
          <span data-tone="muted">Recusar</span>
        </div>

        <div className="wb-guide-trade-selection" aria-hidden="true">
          <div>
            <small>Seleção privada</small>
            <TerritoryCardArtwork
              territoryId={18}
              symbol="gold"
              sizes="92px"
              className={tradeCardClassName}
            />
          </div>
          <div className="wb-guide-trade-swap">
            <small>termos aceitos</small>
            <strong>⇄</strong>
            <span>troca concluída</span>
          </div>
          <div>
            <small>Seleção privada</small>
            <TerritoryCardArtwork
              territoryId={31}
              symbol="water"
              sizes="92px"
              className={tradeCardClassName}
            />
          </div>
        </div>
      </div>

      <figcaption>
        Primeiro os jogadores combinam o tipo de carta. A carta concreta só é escolhida
        depois do aceite, e a troca acontece quando os dois lados concluem a seleção.
      </figcaption>
    </figure>
  );
}

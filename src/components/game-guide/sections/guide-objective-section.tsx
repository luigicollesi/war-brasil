import { GuideHeading } from "@/src/components/game-guide/guide-heading";

const objectiveFamilies = [
  {
    key: "domain",
    mark: "◉",
    title: "Domínio",
    detail: "territórios e regiões",
  },
  {
    key: "expansion",
    mark: "↗",
    title: "Expansão",
    detail: "controle e presença no mapa",
  },
  {
    key: "fortification",
    mark: "▲",
    title: "Fortificação",
    detail: "posições protegidas por tropas",
  },
  {
    key: "elimination",
    mark: "☠",
    title: "Eliminação",
    detail: "retire um rival da partida",
  },
] as const;

export function GuideObjectiveSection() {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--objective">
      <div className="wb-guide-copy">
        <GuideHeading number="03" title="Leia seu objetivo">
          Seu objetivo é secreto. Cumpra todas as condições para vencer.
        </GuideHeading>

        <p className="wb-guide-inline-note">
          <strong>Eliminação por terceiro.</strong> Se outro jogador eliminar seu alvo,
          sua missão é reavaliada conforme os requisitos restantes.
        </p>
      </div>

      <div className="wb-guide-visual">
        <div className="wb-guide-mission-card" aria-label="Tipos de objetivo secreto">
          <div className="wb-guide-mission-head">
            <span>◆ Objetivo secreto</span>
            <strong>Cumpra todas as condições.</strong>
          </div>

          <div className="wb-guide-mission-families">
            {objectiveFamilies.map((family) => (
              <div key={family.key}>
                <span aria-hidden="true">{family.mark}</span>
                <div>
                  <strong>{family.title}</strong>
                  <small>{family.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

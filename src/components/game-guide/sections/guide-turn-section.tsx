import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";

export function GuideTurnSection() {
  return (
    <article className="wb-guide-chapter wb-guide-section--turn">
      <GuideHeading number="04" title="Siga seu turno">
        Seu turno segue sempre a mesma ordem. Fases opcionais podem ser encerradas
        sem ação, mas a sequência não pode ser invertida.
      </GuideHeading>

      <GuideFlow
        ariaLabel="Etapas do turno"
        className="wb-guide-main-turn-flow"
        steps={[
          { key: "cards", eyebrow: "01", label: "Cartas", detail: "opcional" },
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

      <p className="wb-guide-turn-end">
        <strong>Fim do turno.</strong> Depois da manobra, a vez passa para o próximo
        jogador ativo.
      </p>
    </article>
  );
}

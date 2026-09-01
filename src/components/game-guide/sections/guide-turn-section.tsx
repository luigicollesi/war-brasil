import { GameDie } from "@/src/components/game-die";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

const regionalStrategy = {
  nordeste:
    "Maior região do mapa, mas com poucos pontos de entrada; exige grande expansão para conquistar, porém é relativamente mais defensável depois de consolidada.",
  norte:
    "Extensa, mas o domínio inclui o Acre e a vantagem estratégica do Túnel Jurássico.",
  sudeste:
    "Oito territórios muito disputados, com uma recompensa forte sem superar as grandes regiões.",
  "centro-oeste":
    "Poucos territórios, porém posição central e maior exposição tornam o domínio difícil de sustentar.",
  sul:
    "Compacta e periférica, tende a ser mais simples de consolidar e defender.",
} as const;

export function GuideTurnSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
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
          { key: "reinforcement", eyebrow: "02", label: "Reforços", detail: "obrigatório", tone: "accent" },
          { key: "attack", eyebrow: "03", label: "Ataques", detail: "opcional" },
          { key: "maneuver", eyebrow: "04", label: "Manobra", detail: "opcional" },
        ]}
      />

      <p className="wb-guide-turn-end">
        <strong>Fim do turno.</strong> Depois da manobra, a vez passa para o próximo
        jogador ativo.
      </p>

      <div className="wb-guide-turn-reference" aria-label="Referência rápida das regras do turno">
        <p className="wb-guide-label">Referência rápida</p>
        <div className="wb-guide-rule-grid">
          <section>
            <p className="wb-guide-label">Reforços</p>
            <strong className="wb-guide-rule-number">
              {guide.reinforcement.territoryExample} territórios → +{guide.reinforcement.baseExample}
            </strong>
            <p>
              Você recebe metade dos territórios que controla, com mínimo de
              {` ${guide.reinforcement.minimum} tropas`}, além de bônus por regiões
              completas.
            </p>
          </section>

          <section>
            <p className="wb-guide-label">Combate</p>
            <div className="wb-guide-dice-versus" aria-label="Exemplo de comparação de dados">
              <div><GameDie value={6} color="ruby" size="sm" /><GameDie value={4} color="ruby" size="sm" /></div>
              <span>×</span>
              <div><GameDie value={5} color="ocean" size="sm" /><GameDie value={4} color="ocean" size="sm" /></div>
            </div>
            <p>
              Ataque um inimigo conectado. Os maiores dados são comparados entre
              si e <strong>empates favorecem a defesa</strong>. Pelo menos 1 tropa
              permanece na origem.
            </p>
          </section>

          <section>
            <p className="wb-guide-label">Manobra</p>
            <div className="wb-guide-route-chain" aria-label="Rota por territórios próprios">
              <span>A</span><i /><span>B</span><i /><span>C</span>
            </div>
            <p>
              Mova tropas entre territórios seus conectados. Uma cadeia própria
              permite mover de A até C usando B como passagem.
            </p>
          </section>
        </div>
      </div>

      <section
        className="wb-guide-regional-domain"
        aria-labelledby="guide-regional-domain-title"
      >
        <div className="wb-guide-regional-heading">
          <div>
            <p className="wb-guide-label">Domínio regional</p>
            <h3 id="guide-regional-domain-title">
              Regiões completas aceleram seus reforços.
            </h3>
          </div>
          <p>
            <strong>O bônus é adicional ao reforço normal.</strong> Você o recebe
            em toda fase de reforço enquanto controlar todos os territórios da
            região.
          </p>
        </div>

        <div className="wb-guide-region-table-wrap">
          <table className="wb-guide-region-table">
            <thead>
              <tr>
                <th scope="col">Região</th>
                <th scope="col">Territórios</th>
                <th scope="col">Bônus</th>
                <th scope="col">Leitura estratégica</th>
              </tr>
            </thead>
            <tbody>
              {guide.regions.map((region) => (
                <tr key={region.key} data-region={region.key}>
                  <th scope="row">
                    <span className="wb-guide-region-mark" aria-hidden="true" />
                    <span>{region.label}</span>
                  </th>
                  <td>
                    <strong>{region.territoryCount}</strong>
                    <small> territórios</small>
                  </td>
                  <td className="wb-guide-region-bonus">+{region.bonus}</td>
                  <td>{regionalStrategy[region.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="wb-guide-regional-note">
          <strong>O tamanho não é o único fator.</strong> Posição no mapa,
          quantidade de pontos de entrada, exposição a ataques e vantagens
          especiais também pesam no valor de cada região.
        </p>
      </section>
    </article>
  );
}

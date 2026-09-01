import { GuideConnection } from "@/src/components/game-guide/guide-connection";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

const attackChecks = [
  ["✓", "Origem sua"],
  ["✓", "Destino inimigo"],
  ["✓", "Conexão válida"],
] as const;

export function GuideAttackSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--attack">
      <div className="wb-guide-copy">
        <GuideHeading number="06" title="Escolha seu ataque">
          Um ataque normal parte de um território seu com pelo menos
          {` ${guide.attack.normalMinimumTroops} tropas`} para um território inimigo
          conectado. Uma tropa sempre permanece protegendo a origem.
        </GuideHeading>

        <div className="wb-guide-notes">
          <p>
            <strong>Antes dos dados.</strong> Você ainda pode cancelar o ataque.
            Depois da primeira rolagem, aquela batalha precisa ser concluída.
          </p>
          <p>
            <strong>Depois da batalha.</strong> Ataque novamente, escolha outro alvo
            ou encerre a fase. Uma conquista pendente precisa ser ocupada antes de
            qualquer novo ataque.
          </p>
        </div>
      </div>

      <div className="wb-guide-visual wb-guide-attack-example">
        <GuideConnection
          directed
          ariaLabel="Território próprio com quatro tropas atacando um território inimigo conectado com duas tropas"
          from={<GuideTerritoryNode compact name="Origem" troops={4} tone="ally" />}
          to={<GuideTerritoryNode compact name="Inimigo" troops={2} tone="enemy" />}
          caption="Ataque normal permitido. Barreiras Geográficas usam limites próprios, explicados na seção 08."
        />

        <div className="wb-guide-attack-checks" aria-label="Condições de um ataque válido">
          {attackChecks.map(([mark, label]) => (
            <div key={label}>
              <span aria-hidden="true">{mark}</span>
              <strong>{label}</strong>
            </div>
          ))}
          <div>
            <span aria-hidden="true">✓</span>
            <strong>{guide.attack.normalMinimumTroops}+ tropas</strong>
          </div>
        </div>

        <div className="wb-guide-attack-blockers" aria-label="Situações que impedem iniciar um ataque">
          <span>✕ só 1 tropa</span>
          <span>✕ sem conexão</span>
          <span>✕ destino aliado</span>
          <span>✕ origem bloqueada por Anomalia</span>
        </div>
      </div>
    </article>
  );
}

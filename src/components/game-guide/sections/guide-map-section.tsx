import {
  AnomalyIcon,
  RoadsIcon,
  TroopsIcon,
} from "@/src/components/game-utility-icons";
import { GuideConnection } from "@/src/components/game-guide/guide-connection";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { MapReadingExample } from "@/src/components/game-guide/guide-map-examples";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
import { UtilityDemo } from "@/src/components/game-guide/guide-utility-demo";

export function GuideMapSection() {
  return (
    <article className="wb-guide-chapter wb-guide-section--map">
      <div className="wb-guide-core-split wb-guide-core-split--reverse">
        <div className="wb-guide-copy">
          <GuideHeading number="13" title="Leia as conexões do mapa">
            Ataques e manobras seguem as conexões militares do tabuleiro. Dois
            territórios encostarem no desenho não significa, por si só, que existe
            passagem entre eles.
          </GuideHeading>

          <div className="wb-guide-controls">
            <UtilityDemo icon={<RoadsIcon />} label="Estradas">
              Mostra ou esconde as conexões normais entre os territórios.
            </UtilityDemo>
            <UtilityDemo icon={<TroopsIcon />} label="Tropas">
              Mostra ou esconde a quantidade de tropas em cada território.
            </UtilityDemo>
            <UtilityDemo icon={<AnomalyIcon />} label="Anomalia" anomaly>
              Reabre o evento da rodada para consultar seus efeitos atuais.
            </UtilityDemo>
          </div>
        </div>

        <div className="wb-guide-visual">
          <MapReadingExample />
        </div>
      </div>

      <div className="wb-guide-map-legend" aria-label="Tipos de conexão do mapa">
        <GuideConnection
          ariaLabel="Exemplo de conexão normal"
          variant="normal"
          from={<GuideTerritoryNode name="A" troops={3} tone="ally" compact />}
          to={<GuideTerritoryNode name="B" troops={2} tone="enemy" compact />}
          caption="Conexão normal: válida para ataque e para rotas permitidas de manobra."
        />
        <GuideConnection
          ariaLabel="Exemplo de conexão com Barreira Geográfica"
          variant="barrier"
          from={<GuideTerritoryNode name="A" troops={6} tone="ally" compact />}
          to={<GuideTerritoryNode name="B" troops={2} tone="enemy" compact />}
          caption="Barreira: existe fronteira militar, mas o atacante ou a manobra sofre as regras de travessia."
        />
        <GuideConnection
          ariaLabel="Exemplo do Túnel Jurássico entre Acre e outro território"
          variant="tunnel"
          from={<GuideTerritoryNode name="Acre" troops={2} tone="accent" compact />}
          to={<GuideTerritoryNode name="Destino" troops={3} tone="neutral" compact />}
          caption="Túnel Jurássico: conexão temporária e livre de Barreira durante a rodada atual."
        />
      </div>

      <p className="wb-guide-inline-note wb-guide-tunnel-note">
        <strong>Túnel Jurássico.</strong> O Acre recebe um novo destino temporário a
        cada rodada. Enquanto a ligação estiver ativa, ela entra na mesma topologia
        usada para validar ataques e caminhos de manobra.
      </p>
    </article>
  );
}

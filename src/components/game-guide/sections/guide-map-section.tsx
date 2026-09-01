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
          <GuideHeading number="13" title="Leia o mapa">
            As conexões definem por onde ataques e manobras podem acontecer.
            Territórios que apenas se tocam no desenho não são necessariamente
            conectados.
          </GuideHeading>

          <div className="wb-guide-controls">
            <UtilityDemo icon={<RoadsIcon />} label="Estradas">
              Mostra ou esconde as conexões normais.
            </UtilityDemo>
            <UtilityDemo icon={<TroopsIcon />} label="Tropas">
              Mostra ou esconde a quantidade de tropas.
            </UtilityDemo>
            <UtilityDemo icon={<AnomalyIcon />} label="Anomalia" anomaly>
              Reabre os efeitos da rodada atual.
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
          caption="Normal: ataque e manobra."
        />
        <GuideConnection
          ariaLabel="Exemplo de conexão com Barreira Geográfica"
          variant="barrier"
          from={<GuideTerritoryNode name="A" troops={6} tone="ally" compact />}
          to={<GuideTerritoryNode name="B" troops={2} tone="enemy" compact />}
          caption="Barreira: travessia com penalidade."
        />
        <GuideConnection
          ariaLabel="Exemplo do Túnel Jurássico entre Acre e outro território"
          variant="tunnel"
          from={<GuideTerritoryNode name="Acre" troops={2} tone="accent" compact />}
          to={<GuideTerritoryNode name="Destino" troops={3} tone="neutral" compact />}
          caption="Túnel: conexão temporária da rodada."
        />
      </div>

      <p className="wb-guide-inline-note wb-guide-tunnel-note">
        <strong>Túnel Jurássico.</strong> O Acre recebe um novo destino a cada rodada.
        Enquanto ativo, o Túnel conta como conexão normal.
      </p>
    </article>
  );
}

import { createRoadCurve } from "@/src/lib/road-geometry";

type ParaTerritory = {
  id: number;
  name: string;
  fill: string;
  path: string;
  label: { x: number; y: number; lines: readonly string[] };
};

const PARA_TERRITORIES: readonly ParaTerritory[] = [
  {
    id: 6,
    name: "Pará Oeste",
    fill: "#96c155",
    label: { x: 588, y: 276, lines: ["Pará", "Oeste"] },
    path: "M 639.0 462.5 L 623.0 459.5 L 593.0 461.5 L 580.0 459.5 L 569.0 453.5 L 556.0 453.5 L 548.0 449.5 L 539.0 448.5 L 534.0 439.5 L 527.0 437.5 L 522.0 431.5 L 518.0 431.5 L 515.5 429.0 L 519.5 420.0 L 519.5 414.0 L 517.5 409.0 L 508.5 403.0 L 508.5 398.0 L 504.5 392.0 L 506.5 389.0 L 506.5 380.0 L 499.5 373.0 L 496.5 365.0 L 498.5 350.0 L 506.5 341.0 L 514.5 324.0 L 523.5 297.0 L 530.5 287.0 L 533.5 271.0 L 548.5 251.0 L 548.5 238.0 L 553.5 226.0 L 549.0 220.5 L 534.0 218.5 L 522.0 207.5 L 509.0 202.5 L 499.0 191.5 L 494.5 190.0 L 490.0 181.5 L 480.5 178.0 L 479.5 172.0 L 475.5 167.0 L 476.5 151.0 L 471.5 139.0 L 480.0 122.5 L 486.0 123.5 L 492.0 118.5 L 502.0 117.5 L 508.0 110.5 L 516.0 109.5 L 520.0 104.5 L 525.0 102.5 L 533.0 106.5 L 551.0 105.5 L 560.0 110.5 L 565.5 105.0 L 559.5 98.0 L 558.5 91.0 L 563.0 88.5 L 568.0 90.5 L 577.0 89.5 L 585.0 84.5 L 598.5 89.0 L 592.5 99.0 L 593.5 106.0 L 597.0 109.5 L 606.0 113.5 L 612.0 113.5 L 632.5 123.0 L 633.5 132.0 L 642.5 141.0 L 640.5 147.0 L 647.5 155.0 L 648.5 163.0 L 656.5 169.0 L 656.5 173.0 L 663.5 180.0 L 662.5 182.0 L 666.0 186.5 L 679.0 190.5 L 680.5 196.0 L 686.5 200.0 L 678.5 209.0 L 679.5 216.0 L 687.0 219.5 L 692.0 226.5 L 702.0 228.5 L 709.5 236.0 L 711.5 248.0 L 716.0 252.5 L 721.0 253.5 L 727.5 263.0 L 726.5 268.0 L 714.5 279.0 L 711.5 289.0 L 703.5 295.0 L 700.5 306.0 L 690.5 313.0 L 685.5 327.0 L 687.5 330.0 L 686.5 333.0 L 676.5 341.0 L 670.5 352.0 L 667.5 364.0 L 669.5 388.0 L 666.5 394.0 L 658.5 400.0 L 656.5 414.0 L 645.5 441.0 L 643.5 459.0 L 639.0 462.5 Z",
  },
  {
    id: 9,
    name: "Pará Sudeste",
    fill: "#82ad53",
    label: { x: 721, y: 382, lines: ["Pará", "Sudeste"] },
    path: "M 723.0 467.5 L 703.0 466.5 L 687.0 459.5 L 671.0 460.5 L 657.0 458.5 L 655.0 460.5 L 648.0 460.5 L 647.5 453.0 L 650.5 440.0 L 655.5 432.0 L 661.5 413.0 L 662.5 403.0 L 673.5 391.0 L 672.5 362.0 L 674.5 354.0 L 680.5 343.0 L 691.5 334.0 L 694.5 315.0 L 704.5 308.0 L 708.5 296.0 L 716.5 290.0 L 719.5 280.0 L 727.0 273.5 L 732.0 273.5 L 740.0 276.5 L 744.0 282.5 L 753.0 284.5 L 757.5 290.0 L 759.5 299.0 L 769.5 305.0 L 771.5 312.0 L 779.0 315.5 L 787.0 325.5 L 795.5 329.0 L 793.5 341.0 L 786.5 347.0 L 786.5 356.0 L 767.5 369.0 L 766.5 379.0 L 759.5 385.0 L 757.5 391.0 L 763.5 401.0 L 763.5 408.0 L 756.5 423.0 L 739.5 439.0 L 734.5 449.0 L 733.5 457.0 L 723.0 467.5 Z",
  },
  {
    id: 11,
    name: "Pará Atlântico",
    fill: "#85b86b",
    label: { x: 788, y: 260, lines: ["Pará", "Atlântico"] },
    path: "M 784.0 313.5 L 779.0 309.5 L 777.0 310.5 L 773.5 303.0 L 763.5 296.0 L 762.5 289.0 L 758.0 282.5 L 754.0 279.5 L 747.0 278.5 L 740.0 270.5 L 731.5 268.0 L 731.5 260.0 L 726.5 256.0 L 726.5 252.0 L 724.0 249.5 L 716.5 247.0 L 712.5 232.0 L 703.0 222.5 L 694.0 221.5 L 690.0 215.5 L 685.0 214.5 L 683.5 212.0 L 685.0 208.5 L 704.0 198.5 L 709.0 189.5 L 713.0 191.5 L 717.5 186.0 L 716.5 180.0 L 721.0 175.5 L 726.0 176.5 L 731.0 169.5 L 755.0 169.5 L 762.0 164.5 L 769.0 164.5 L 775.0 168.5 L 789.0 168.5 L 790.5 173.0 L 785.5 181.0 L 784.5 189.0 L 778.5 194.0 L 773.0 207.5 L 747.0 214.5 L 733.0 211.5 L 722.0 217.5 L 715.0 214.5 L 703.0 214.5 L 700.5 217.0 L 710.0 224.5 L 724.0 222.5 L 733.0 217.5 L 748.0 222.5 L 752.0 217.5 L 756.5 221.0 L 756.5 226.0 L 760.0 228.5 L 766.0 218.5 L 773.0 215.5 L 777.0 210.5 L 788.0 207.5 L 791.5 204.0 L 792.5 196.0 L 796.5 188.0 L 806.0 182.5 L 815.0 185.5 L 819.0 182.5 L 825.0 182.5 L 831.0 187.5 L 853.0 195.5 L 856.5 200.0 L 857.5 203.0 L 853.5 207.0 L 853.5 224.0 L 849.5 229.0 L 843.5 251.0 L 835.5 261.0 L 831.5 271.0 L 825.5 276.0 L 818.5 294.0 L 813.0 298.5 L 807.0 299.5 L 800.0 306.5 L 796.0 304.5 L 789.0 305.5 L 784.0 313.5 Z",
  },
] as const;

const PARA_ATLANTIC_ANCHOR = { x: 775, y: 242 };
const PARA_SOUTHEAST_ANCHOR = { x: 722, y: 370 };
const PARA_ROAD = createRoadCurve(
  PARA_ATLANTIC_ANCHOR,
  PARA_SOUTHEAST_ANCHOR,
  11,
  9,
);

// Trecho da fronteira compartilhada por Pará Oeste e Pará Sudeste.
const GEOGRAPHIC_BARRIER_BOUNDARY =
  "M 727 273.5 L 719.5 280 L 716.5 290 L 708.5 296 L 704.5 308 L 694.5 315 L 691.5 334 L 680.5 343 L 674.5 354 L 672.5 362 L 673.5 391 L 662.5 403 L 661.5 413 L 655.5 432 L 650.5 440 L 647.5 453 L 648 460.5";

function ParaMapBase({ reading = false }: { reading?: boolean }) {
  return (
    <svg
      className="wb-guide-para-map"
      viewBox="455 65 435 430"
      role="img"
      aria-label={
        reading
          ? "Exemplo de leitura do mapa com territórios, tropas e estrada"
          : "Pará Oeste, Pará Sudeste e Pará Atlântico mostrando estrada e Barreira Geográfica"
      }
    >
      <g className="wb-guide-para-territories">
        {PARA_TERRITORIES.map((territory) => (
          <path
            key={territory.id}
            d={territory.path}
            fill={territory.fill}
            data-territory-id={territory.id}
            data-territory-name={territory.name}
          />
        ))}
      </g>

      {reading ? (
        <path
          d={PARA_TERRITORIES[1].path}
          className="wb-guide-map-selected-territory"
        />
      ) : (
        <path
          d={GEOGRAPHIC_BARRIER_BOUNDARY}
          className="wb-guide-map-barrier-boundary"
        />
      )}

      <g className="wb-guide-map-road" aria-label="Estrada entre Pará Atlântico e Pará Sudeste">
        <path d={PARA_ROAD} className="wb-guide-map-road-shadow" />
        <path d={PARA_ROAD} className="wb-guide-map-road-surface" />
        <path d={PARA_ROAD} className="wb-guide-map-road-center" />
      </g>

      {!reading ? (
        <g className="wb-guide-map-barrier-label" transform="translate(614 414)">
          <rect width="132" height="37" rx="10" />
          <text x="66" y="15">BARREIRA</text>
          <text x="66" y="29">GEOGRÁFICA</text>
        </g>
      ) : null}

      {PARA_TERRITORIES.map((territory) => (
        <text
          key={`label-${territory.id}`}
          x={territory.label.x}
          y={territory.label.y}
          className="wb-guide-map-territory-name"
          textAnchor="middle"
        >
          {territory.label.lines.map((line, index) => (
            <tspan
              key={line}
              x={territory.label.x}
              dy={index === 0 ? 0 : 17}
            >
              {line}
            </tspan>
          ))}
        </text>
      ))}

      {reading ? (
        <g className="wb-guide-map-troop-markers" aria-label="Exemplo de contadores de tropas">
          <g transform="translate(588 329)"><circle r="17" /><text y="1">5</text></g>
          <g transform="translate(721 414)"><circle r="17" /><text y="1">2</text></g>
          <g transform="translate(809 210)"><circle r="17" /><text y="1">7</text></g>
        </g>
      ) : null}
    </svg>
  );
}

export function GeographicBarrierMapExample() {
  return (
    <figure className="wb-guide-geographic-map-example">
      <div className="wb-guide-map-frame">
        <ParaMapBase />
      </div>
      <figcaption className="wb-guide-geographic-map-caption">
        <span><i className="wb-guide-road-key" /> Estrada: conexão normal</span>
        <span><i className="wb-guide-barrier-key" /> Fronteira sem estrada: Barreira Geográfica</span>
      </figcaption>
    </figure>
  );
}

export function MapReadingExample() {
  return (
    <figure className="wb-guide-map-reading-example">
      <div className="wb-guide-map-frame wb-guide-map-frame--reading">
        <ParaMapBase reading />
      </div>

      <div className="wb-guide-map-reading-legend" aria-label="Legenda do mapa">
        <div><i className="wb-guide-reading-road" /><span><strong>Estrada</strong> conexão normal</span></div>
        <div><i className="wb-guide-reading-troop">5</i><span><strong>Tropas</strong> quantidade no território</span></div>
        <div><i className="wb-guide-reading-selection" /><span><strong>Destaque</strong> território selecionado</span></div>
      </div>

      <div className="wb-guide-reading-tunnel">
        <div className="wb-guide-reading-tunnel-heading">
          <span>🦖</span>
          <div><small>Conexão especial</small><strong>Túnel Jurássico</strong></div>
        </div>
        <svg viewBox="0 0 420 92" role="img" aria-label="Túnel Jurássico ligando o Acre ao destino da rodada">
          <path d="M 74 55 Q 210 -8 346 55" className="wb-guide-tunnel-shadow" />
          <path d="M 74 55 Q 210 -8 346 55" className="wb-guide-tunnel-route" />
          <g transform="translate(50 55)"><circle r="24" /><text y="4">AC</text></g>
          <g transform="translate(370 55)"><circle r="24" /><text y="4">?</text></g>
        </svg>
        <p>
          A cada rodada, o Acre recebe uma conexão temporária com outro território.
          A linha tracejada mostra qual destino está ligado pelo túnel naquele momento.
        </p>
      </div>
    </figure>
  );
}

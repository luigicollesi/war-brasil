"use client";

import { useGameMapVisibility } from "@/src/components/road-visibility-provider";

type GameUtilityBarProps = {
  anomalyTitle?: string;
  onOpenAnomaly?: () => void;
};

function RoadsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2 5 22M16 2l3 20M12 4v3m0 4v3m0 4v2" />
    </svg>
  );
}

function TroopsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="3" />
      <path d="M7.5 20h9M9 17h6l-1.2-5h-3.6L9 17Z" />
    </svg>
  );
}

function AnomalyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M7.1 7.1 5 5m14 14-2.1-2.1M16.9 7.1 19 5M5 19l2.1-2.1" />
    </svg>
  );
}

export function GameUtilityBar({
  anomalyTitle,
  onOpenAnomaly,
}: GameUtilityBarProps) {
  const {
    roadsVisible,
    troopsVisible,
    toggleRoads,
    toggleTroops,
  } = useGameMapVisibility();

  return (
    <div className="game-utility-bar" aria-label="Controles de visualização do mapa">
      <button
        type="button"
        className="game-utility-button"
        aria-pressed={roadsVisible}
        onClick={toggleRoads}
        title={roadsVisible ? "Ocultar estradas" : "Mostrar estradas"}
      >
        <RoadsIcon />
        <span className="game-utility-label">Estradas</span>
      </button>

      <button
        type="button"
        className="game-utility-button"
        aria-pressed={troopsVisible}
        onClick={toggleTroops}
        title={troopsVisible ? "Ocultar tropas" : "Mostrar tropas"}
      >
        <TroopsIcon />
        <span className="game-utility-label">Tropas</span>
      </button>

      {anomalyTitle && onOpenAnomaly ? (
        <>
          <span className="game-utility-divider" aria-hidden="true" />
          <button
            type="button"
            className="game-utility-button game-utility-button--anomaly"
            onClick={onOpenAnomaly}
            title={`Anomalia atual: ${anomalyTitle}`}
          >
            <AnomalyIcon />
            <span className="game-utility-label">Anomalia</span>
          </button>
        </>
      ) : null}
    </div>
  );
}

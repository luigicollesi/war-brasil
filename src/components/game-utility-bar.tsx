"use client";

import {
  AnomalyIcon,
  RoadsIcon,
  TroopsIcon,
} from "@/src/components/game-utility-icons";
import { useGameMapVisibility } from "@/src/components/road-visibility-provider";

type GameUtilityBarProps = {
  anomalyTitle?: string;
  onOpenAnomaly?: () => void;
};

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

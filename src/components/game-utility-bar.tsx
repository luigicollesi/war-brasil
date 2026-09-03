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
  disabled?: boolean;
};

export function GameUtilityBar({
  anomalyTitle,
  onOpenAnomaly,
  disabled = false,
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
        className="game-utility-button disabled:cursor-not-allowed disabled:opacity-40"
        aria-pressed={roadsVisible}
        disabled={disabled}
        onClick={toggleRoads}
        title={
          disabled
            ? "Estradas indisponíveis durante o sorteio de territórios"
            : roadsVisible
              ? "Ocultar estradas"
              : "Mostrar estradas"
        }
      >
        <RoadsIcon />
        <span className="game-utility-label">Estradas</span>
      </button>

      <button
        type="button"
        className="game-utility-button disabled:cursor-not-allowed disabled:opacity-40"
        aria-pressed={troopsVisible}
        disabled={disabled}
        onClick={toggleTroops}
        title={
          disabled
            ? "Tropas indisponíveis durante o sorteio de territórios"
            : troopsVisible
              ? "Ocultar tropas"
              : "Mostrar tropas"
        }
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

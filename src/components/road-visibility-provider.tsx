"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const ROAD_VISIBILITY_KEY = "war-brasil:roads-visible";
const TROOP_VISIBILITY_KEY = "war-brasil:troops-visible";
const RoadVisibilityContext = createContext(false);
const TroopVisibilityContext = createContext(false);

export function RoadVisibilityProvider({ children }: { children: ReactNode }) {
  const [roadsVisible, setRoadsVisible] = useState(false);
  const [troopsVisible, setTroopsVisible] = useState(false);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      try {
        setRoadsVisible(
          window.localStorage.getItem(ROAD_VISIBILITY_KEY) === "true",
        );
        setTroopsVisible(
          window.localStorage.getItem(TROOP_VISIBILITY_KEY) === "true",
        );
      } catch {
        setRoadsVisible(false);
        setTroopsVisible(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function toggleRoads() {
    setRoadsVisible((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(ROAD_VISIBILITY_KEY, String(next));
      } catch {
        // A preferência continua válida durante a sessão mesmo sem storage.
      }

      return next;
    });
  }

  function toggleTroops() {
    setTroopsVisible((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(TROOP_VISIBILITY_KEY, String(next));
      } catch {
        // A preferência continua válida durante a sessão mesmo sem storage.
      }

      return next;
    });
  }

  return (
    <RoadVisibilityContext.Provider value={roadsVisible}>
      <TroopVisibilityContext.Provider value={troopsVisible}>
        <button
          type="button"
          className="game-road-toggle"
          aria-pressed={roadsVisible}
          onClick={toggleRoads}
          title={roadsVisible ? "Ocultar estradas" : "Mostrar estradas"}
        >
          <span aria-hidden="true">🛣️</span>
          <span>Estradas</span>
          <strong>{roadsVisible ? "ON" : "OFF"}</strong>
        </button>
        <button
          type="button"
          className="game-troop-toggle"
          aria-pressed={troopsVisible}
          onClick={toggleTroops}
          title={troopsVisible ? "Ocultar número de tropas" : "Mostrar número de tropas"}
        >
          <span aria-hidden="true">♟️</span>
          <span>Tropas</span>
          <strong>{troopsVisible ? "ON" : "OFF"}</strong>
        </button>
        {children}
      </TroopVisibilityContext.Provider>
    </RoadVisibilityContext.Provider>
  );
}

export function useRoadVisibility() {
  return useContext(RoadVisibilityContext);
}

export function useTroopVisibility() {
  return useContext(TroopVisibilityContext);
}

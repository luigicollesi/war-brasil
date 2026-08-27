"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const ROAD_VISIBILITY_KEY = "war-brasil:roads-visible";
const RoadVisibilityContext = createContext(false);

export function RoadVisibilityProvider({ children }: { children: ReactNode }) {
  const [roadsVisible, setRoadsVisible] = useState(false);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      try {
        setRoadsVisible(
          window.localStorage.getItem(ROAD_VISIBILITY_KEY) === "true",
        );
      } catch {
        setRoadsVisible(false);
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

  return (
    <RoadVisibilityContext.Provider value={roadsVisible}>
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
      {children}
    </RoadVisibilityContext.Provider>
  );
}

export function useRoadVisibility() {
  return useContext(RoadVisibilityContext);
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const ROAD_VISIBILITY_KEY = "war-brasil:roads-visible";
const TROOP_VISIBILITY_KEY = "war-brasil:troops-visible";

type GameMapVisibilityContextValue = {
  roadsVisible: boolean;
  troopsVisible: boolean;
  toggleRoads: () => void;
  toggleTroops: () => void;
};

const GameMapVisibilityContext =
  createContext<GameMapVisibilityContextValue | null>(null);

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

  const value = useMemo(
    () => ({ roadsVisible, troopsVisible, toggleRoads, toggleTroops }),
    [roadsVisible, troopsVisible],
  );

  return (
    <GameMapVisibilityContext.Provider value={value}>
      {children}
    </GameMapVisibilityContext.Provider>
  );
}

export function useGameMapVisibility() {
  const context = useContext(GameMapVisibilityContext);
  if (!context) {
    throw new Error(
      "useGameMapVisibility precisa ser usado dentro de RoadVisibilityProvider.",
    );
  }
  return context;
}

export function useRoadVisibility() {
  return useGameMapVisibility().roadsVisible;
}

export function useTroopVisibility() {
  return useGameMapVisibility().troopsVisible;
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./command-home.module.css";

type CeremonyPhase = "earth" | "brazil" | "table" | "stable";
type VisitMode = "first" | "repeat" | "reduced";
type DestinationId = "operations" | "doctrine" | "profile";
type HomeState =
  | "boot"
  | "awaiting-entry"
  | "command-open"
  | "destination-focus"
  | "transitioning";

type Destination = {
  id: DestinationId;
  href: string;
  index: string;
  label: string;
  detail: string;
};

type CommandHomeClientProps = {
  children: ReactNode;
};

const HOME_RITUAL_SESSION_KEY = "war-brasil:pre-game-home-ritual-seen";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const DESTINATIONS: Destination[] = [
  {
    id: "operations",
    href: "/matchmaking",
    index: "01",
    label: "OPERAÇÕES",
    detail: "Autorizar ou localizar uma operação",
  },
  {
    id: "doctrine",
    href: "/rules",
    index: "02",
    label: "DOUTRINA",
    detail: "Consultar princípios e regras de combate",
  },
  {
    id: "profile",
    href: "/profile",
    index: "03",
    label: "COMANDO",
    detail: "Acessar identidade e registro de comando",
  },
];

function subscribeReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

function wasRitualSeenThisSession() {
  try {
    return sessionStorage.getItem(HOME_RITUAL_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markRitualSeen() {
  try {
    sessionStorage.setItem(HOME_RITUAL_SESSION_KEY, "1");
  } catch {
    // The ritual remains functional when session storage is unavailable.
  }
}

export function CommandHomeClient({ children }: CommandHomeClientProps) {
  const [ceremonyPhase, setCeremonyPhase] = useState<CeremonyPhase>("earth");
  const [repeatVisit, setRepeatVisit] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [destinationFocus, setDestinationFocus] = useState<DestinationId | null>(null);
  const [transitioningTo, setTransitioningTo] = useState<DestinationId | null>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );

  const visitMode: VisitMode = reducedMotion ? "reduced" : repeatVisit ? "repeat" : "first";
  const effectiveCeremonyPhase: CeremonyPhase =
    visitMode === "first" ? ceremonyPhase : "stable";

  useEffect(() => {
    const wasSeen = wasRitualSeenThisSession();
    markRitualSeen();

    if (!wasSeen) return;

    const frame = window.requestAnimationFrame(() => {
      setRepeatVisit(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (visitMode !== "first" || ceremonyPhase === "stable") return;

    const delay =
      ceremonyPhase === "earth" ? 460 : ceremonyPhase === "brazil" ? 520 : 560;

    const timer = window.setTimeout(() => {
      setCeremonyPhase((current) => {
        if (current === "earth") return "brazil";
        if (current === "brazil") return "table";
        if (current === "table") return "stable";
        return current;
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [ceremonyPhase, visitMode]);

  const skipCeremony = () => {
    setCeremonyPhase("stable");
  };

  const enterCommand = () => {
    setCeremonyPhase("stable");
    setDestinationFocus(null);
    setCommandOpen(true);
  };

  const clearFocus = (destination: DestinationId) => {
    setDestinationFocus((current) => (current === destination ? null : current));
  };

  const homeState: HomeState = transitioningTo
    ? "transitioning"
    : commandOpen && destinationFocus
      ? "destination-focus"
      : commandOpen
        ? "command-open"
        : effectiveCeremonyPhase === "earth"
          ? "boot"
          : "awaiting-entry";

  return (
    <main
      className={styles.root}
      data-home-state={homeState}
      data-scene="fallback"
      data-ceremony={effectiveCeremonyPhase}
      data-visit={visitMode}
      data-command-open={commandOpen ? "true" : "false"}
      data-destination-focus={destinationFocus ?? "none"}
      data-transitioning-to={transitioningTo ?? "none"}
    >
      {children}

      <section id="home-command" className={styles.commandDock} aria-label="Acesso ao comando">
        {!commandOpen ? (
          <div className={styles.authorization}>
            <button type="button" className={styles.enterButton} onClick={enterCommand}>
              <span className={styles.enterButtonCode} aria-hidden="true">A-01</span>
              <span>ENTRAR NO COMANDO</span>
              <span className={styles.enterButtonArrow} aria-hidden="true">→</span>
            </button>

            <div className={styles.authorizationMeta}>
              <span>ACESSO OPERACIONAL DISPONÍVEL</span>
              {effectiveCeremonyPhase !== "stable" && visitMode === "first" ? (
                <button type="button" className={styles.skipCeremony} onClick={skipCeremony}>
                  Pular ritual
                </button>
              ) : (
                <span className={styles.ritualState}>
                  {visitMode === "reduced"
                    ? "MOVIMENTO REDUZIDO"
                    : visitMode === "repeat"
                      ? "RETORNO RECONHECIDO"
                      : "MESA ESTABILIZADA"}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.openCommand}>
            <div className={styles.commandStatus} role="status">
              <span className={styles.commandStatusMark} aria-hidden="true" />
              COMANDO AUTORIZADO
            </div>

            <nav className={styles.destinationRail} aria-label="Destinos do comando">
              {DESTINATIONS.map((destination) => (
                <Link
                  key={destination.id}
                  href={destination.href}
                  className={styles.destination}
                  data-destination={destination.id}
                  onClick={() => setTransitioningTo(destination.id)}
                  onFocus={() => setDestinationFocus(destination.id)}
                  onBlur={() => clearFocus(destination.id)}
                  onPointerEnter={() => setDestinationFocus(destination.id)}
                  onPointerLeave={() => clearFocus(destination.id)}
                >
                  <span className={styles.destinationIndex} aria-hidden="true">
                    {destination.index}
                  </span>
                  <span className={styles.destinationCopy}>
                    <strong>{destination.label}</strong>
                    <span>{destination.detail}</span>
                  </span>
                  <span className={styles.destinationArrow} aria-hidden="true">↗</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </section>

      <footer className={styles.footer} aria-hidden="true">
        <span>DOMÍNIO TERRITORIAL // BRASIL</span>
        <span>PROTOCOLO 42-T</span>
      </footer>
    </main>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  COMMAND_ENTRANCE_DURATION_MS,
  useCommandSceneDirective,
  useCommandSceneState,
} from "../foundation";
import {
  getHomeSceneIntent,
  type HomeCeremonyPhase,
  type HomeDestinationId,
} from "./command-home-scene-intent";
import "./command-home-intro.module.css";
import styles from "./command-home.module.css";

type VisitMode = "first" | "repeat" | "reduced";
type HomeTransitionState = "preparing" | "running" | "complete";
type HomeState =
  | "boot"
  | "awaiting-entry"
  | "command-open"
  | "destination-focus"
  | "transitioning";

type Destination = {
  id: HomeDestinationId;
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

let ritualSeenInRuntime = false;

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
  if (ritualSeenInRuntime) return true;

  try {
    return sessionStorage.getItem(HOME_RITUAL_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markRitualSeen() {
  ritualSeenInRuntime = true;

  try {
    sessionStorage.setItem(HOME_RITUAL_SESSION_KEY, "1");
  } catch {
    // Session storage is an enhancement; the Home remains functional without it.
  }
}

export function CommandHomeClient({ children }: CommandHomeClientProps) {
  const [ceremonyPhase, setCeremonyPhase] = useState<HomeCeremonyPhase>("brazil");
  const [ritualActive, setRitualActive] = useState(() => !ritualSeenInRuntime);
  const [repeatVisit, setRepeatVisit] = useState(() => ritualSeenInRuntime);
  const [entranceStartedAtMs, setEntranceStartedAtMs] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [keyboardDestinationFocus, setKeyboardDestinationFocus] =
    useState<HomeDestinationId | null>(null);
  const [pointerDestinationFocus, setPointerDestinationFocus] =
    useState<HomeDestinationId | null>(null);
  const [transitioningTo, setTransitioningTo] =
    useState<HomeDestinationId | null>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const sceneState = useCommandSceneState();

  const visitMode: VisitMode = reducedMotion
    ? "reduced"
    : repeatVisit
      ? "repeat"
      : "first";
  const effectiveCeremonyPhase: HomeCeremonyPhase =
    visitMode === "first" && ritualActive && sceneState !== "fallback"
      ? ceremonyPhase
      : "stable";
  const homeTransition: HomeTransitionState =
    visitMode !== "first" || !ritualActive || sceneState === "fallback"
      ? "complete"
      : entranceStartedAtMs === null
        ? "preparing"
        : "running";
  const destinationFocus = keyboardDestinationFocus ?? pointerDestinationFocus;
  const sceneIntent = getHomeSceneIntent({
    ceremonyPhase: effectiveCeremonyPhase,
    commandOpen,
    destinationFocus,
    transitioningTo,
    entranceStartedAtMs:
      homeTransition === "running" ? entranceStartedAtMs : null,
    entranceDurationMs: COMMAND_ENTRANCE_DURATION_MS,
  });

  useCommandSceneDirective(sceneIntent);

  useEffect(() => {
    const wasSeen = wasRitualSeenThisSession();
    markRitualSeen();

    if (!wasSeen || repeatVisit) return;

    const frame = window.requestAnimationFrame(() => {
      setRepeatVisit(true);
      setRitualActive(false);
      setEntranceStartedAtMs(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [repeatVisit]);

  useEffect(() => {
    if (
      visitMode !== "first" ||
      !ritualActive ||
      sceneState !== "ready" ||
      entranceStartedAtMs !== null
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setEntranceStartedAtMs(performance.now());
      setCeremonyPhase("table");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [entranceStartedAtMs, ritualActive, sceneState, visitMode]);

  useEffect(() => {
    if (entranceStartedAtMs === null || visitMode !== "first" || !ritualActive) {
      return;
    }

    const stableTimer = window.setTimeout(() => {
      setCeremonyPhase("stable");
      setRitualActive(false);
      setEntranceStartedAtMs(null);
    }, COMMAND_ENTRANCE_DURATION_MS);

    return () => window.clearTimeout(stableTimer);
  }, [entranceStartedAtMs, ritualActive, visitMode]);

  const skipCeremony = () => {
    setCeremonyPhase("stable");
    setRitualActive(false);
    setEntranceStartedAtMs(null);
  };

  const enterCommand = () => {
    setCeremonyPhase("stable");
    setRitualActive(false);
    setEntranceStartedAtMs(null);
    setKeyboardDestinationFocus(null);
    setPointerDestinationFocus(null);
    setCommandOpen(true);
  };

  const clearKeyboardFocus = (destination: HomeDestinationId) => {
    setKeyboardDestinationFocus((current) =>
      current === destination ? null : current,
    );
  };

  const clearPointerFocus = (destination: HomeDestinationId) => {
    setPointerDestinationFocus((current) =>
      current === destination ? null : current,
    );
  };

  const homeState: HomeState = transitioningTo
    ? "transitioning"
    : commandOpen && destinationFocus
      ? "destination-focus"
      : commandOpen
        ? "command-open"
        : homeTransition === "preparing"
          ? "boot"
          : "awaiting-entry";

  return (
    <main
      className={styles.root}
      data-home-state={homeState}
      data-home-transition={homeTransition}
      data-scene="foundation"
      data-scene-state={sceneState}
      data-ceremony={effectiveCeremonyPhase}
      data-visit={visitMode}
      data-command-open={commandOpen ? "true" : "false"}
      data-destination-focus={destinationFocus ?? "none"}
      data-transitioning-to={transitioningTo ?? "none"}
    >
      {children}

      <section
        id="home-command"
        className={styles.commandDock}
        data-home-command-dock
        aria-label="Acesso ao comando"
        tabIndex={-1}
      >
        {!commandOpen ? (
          <div className={styles.authorization}>
            <button
              type="button"
              className={styles.enterButton}
              onClick={enterCommand}
            >
              <span className={styles.enterButtonCode} aria-hidden="true">
                A-01
              </span>
              <span>ENTRAR NO COMANDO</span>
              <span className={styles.enterButtonArrow} aria-hidden="true">
                →
              </span>
            </button>

            <div className={styles.authorizationMeta}>
              <span>ACESSO OPERACIONAL DISPONÍVEL</span>
              {effectiveCeremonyPhase !== "stable" && visitMode === "first" ? (
                <button
                  type="button"
                  className={styles.skipCeremony}
                  onClick={skipCeremony}
                >
                  Pular ritual
                </button>
              ) : (
                <span className={styles.ritualState}>
                  {visitMode === "reduced"
                    ? "MOVIMENTO REDUZIDO"
                    : visitMode === "repeat"
                      ? "RETORNO RECONHECIDO"
                      : sceneState === "fallback"
                        ? "MODO TÁTICO 2D"
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
                  onFocus={() => setKeyboardDestinationFocus(destination.id)}
                  onBlur={() => clearKeyboardFocus(destination.id)}
                  onPointerEnter={() => setPointerDestinationFocus(destination.id)}
                  onPointerLeave={() => clearPointerFocus(destination.id)}
                >
                  <span className={styles.destinationIndex} aria-hidden="true">
                    {destination.index}
                  </span>
                  <span className={styles.destinationCopy}>
                    <strong>{destination.label}</strong>
                    <span>{destination.detail}</span>
                  </span>
                  <span className={styles.destinationArrow} aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </section>

      <footer className={styles.footer} data-home-footer aria-hidden="true">
        <span>DOMÍNIO TERRITORIAL // BRASIL</span>
        <span>PROTOCOLO 42-T</span>
      </footer>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./command-home.module.css";

type CeremonyPhase = "earth" | "brazil" | "table" | "stable";
type VisitMode = "first" | "repeat" | "reduced";
type DestinationId = "operations" | "doctrine" | "profile";

type Destination = {
  id: DestinationId;
  href: string;
  index: string;
  label: string;
  detail: string;
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

function safelyReadRepeatVisit() {
  try {
    const repeatVisit = sessionStorage.getItem(HOME_RITUAL_SESSION_KEY) === "1";
    sessionStorage.setItem(HOME_RITUAL_SESSION_KEY, "1");
    return repeatVisit;
  } catch {
    return false;
  }
}

export function CommandHomeClient() {
  const [ceremonyPhase, setCeremonyPhase] = useState<CeremonyPhase>("earth");
  const [visitMode, setVisitMode] = useState<VisitMode>("first");
  const [commandOpen, setCommandOpen] = useState(false);
  const [destinationFocus, setDestinationFocus] = useState<DestinationId | null>(null);

  useEffect(() => {
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const repeatVisit = safelyReadRepeatVisit();

    if (motionQuery.matches) {
      setVisitMode("reduced");
      setCeremonyPhase("stable");
    } else if (repeatVisit) {
      setVisitMode("repeat");
      setCeremonyPhase("stable");
    }

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setVisitMode("reduced");
      setCeremonyPhase("stable");
    };

    motionQuery.addEventListener("change", handleMotionPreference);

    return () => {
      motionQuery.removeEventListener("change", handleMotionPreference);
    };
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

  const clearPointerFocus = (destination: DestinationId) => {
    setDestinationFocus((current) => (current === destination ? null : current));
  };

  return (
    <main
      className={styles.root}
      data-ceremony={ceremonyPhase}
      data-visit={visitMode}
      data-command-open={commandOpen ? "true" : "false"}
      data-destination-focus={destinationFocus ?? "none"}
    >
      <div className={styles.environment} aria-hidden="true">
        <div className={styles.environmentGrid} />
        <div className={styles.environmentVignette} />
      </div>

      <header className={styles.header}>
        <a href="#home-command" className={styles.skipToCommand}>
          Ir para o comando
        </a>

        <div className={styles.brandLockup} aria-label="WAR Brasil">
          <span className={styles.brandMonogram} aria-hidden="true">WB</span>
          <span className={styles.brandText}>
            <strong>WAR</strong>
            <span>BRASIL</span>
          </span>
        </div>

        <div className={styles.headerTelemetry} aria-hidden="true">
          <span>INSTALAÇÃO DE COMANDO</span>
          <span>SETOR BR / 42T</span>
        </div>
      </header>

      <section className={styles.stage} aria-labelledby="home-title">
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.globeShell}>
            <div className={styles.globe}>
              <span className={styles.globeMeridian} />
              <span className={styles.globeLatitude} />
              <span className={styles.globeSignal} />
            </div>
          </div>

          <div className={styles.crown}>
            <span className={`${styles.orbit} ${styles.orbitTerritory}`} />
            <span className={`${styles.orbit} ${styles.orbitCommand}`} />
            <span className={`${styles.orbit} ${styles.orbitConflict}`} />
          </div>

          <div className={styles.domainTable}>
            <span className={styles.tableOuterRing} />
            <span className={styles.tableInnerRing} />
            <span className={styles.tableAxis} />
            <div className={styles.brazilAssembly}>
              <div className={styles.mapUnderlay} />
              <Image
                src="/war-brasil-42.production.svg"
                alt=""
                width={1200}
                height={1200}
                priority
                sizes="(max-width: 720px) 78vw, 620px"
                className={styles.brazilMap}
              />
            </div>
          </div>

          <div className={styles.foundationRail} />
        </div>

        <div className={styles.identity}>
          <p className={styles.kicker}>AUTORIDADE TERRITORIAL / BRASIL</p>
          <h1 id="home-title" className={styles.title}>
            <span>WAR</span>
            <strong>BRASIL</strong>
          </h1>
          <p className={styles.subtitle}>
            Quarenta e dois territórios. Uma mesa de domínio. Uma ordem de comando.
          </p>
        </div>
      </section>

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
              {ceremonyPhase !== "stable" && visitMode === "first" ? (
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
                  onFocus={() => setDestinationFocus(destination.id)}
                  onBlur={() => clearPointerFocus(destination.id)}
                  onPointerEnter={() => setDestinationFocus(destination.id)}
                  onPointerLeave={() => clearPointerFocus(destination.id)}
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

import Image from "next/image";
import polish from "./command-home-polish.module.css";
import styles from "./command-home.module.css";

export function CommandHomeFallback() {
  return (
    <>
      <div className={styles.environment} aria-hidden="true">
        <div className={styles.environmentGrid} />
        <div className={styles.environmentVignette} />
      </div>

      <header className={styles.header}>
        <a href="#home-command" className={styles.skipToCommand}>
          Ir para o comando
        </a>

        <div className={styles.brandLockup} aria-label="WAR Brasil">
          <span className={styles.brandMonogram} aria-hidden="true">
            <span>WB</span>
          </span>
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

          <div className={`${styles.crown} ${polish.viewportBounded}`}>
            <span className={`${styles.orbit} ${styles.orbitTerritory}`} />
            <span className={`${styles.orbit} ${styles.orbitCommand}`} />
            <span className={`${styles.orbit} ${styles.orbitConflict}`} />
          </div>

          <div className={`${styles.domainTable} ${polish.viewportBounded}`}>
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
                preload
                unoptimized
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
    </>
  );
}

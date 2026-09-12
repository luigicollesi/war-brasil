import styles from "./command-home.module.css";

export function CommandHomeContent() {
  return (
    <section className={styles.identity} aria-labelledby="home-title">
      <p className={styles.kicker}>AUTORIDADE TERRITORIAL / BRASIL</p>
      <h1 id="home-title" className={styles.title}>
        <span>WAR</span>
        <strong>BRASIL</strong>
      </h1>
      <p className={styles.subtitle}>
        Quarenta e dois territórios. Uma mesa de domínio. Uma ordem de comando.
      </p>
      <div className={styles.identityTelemetry} aria-hidden="true">
        <span>42 TERRITÓRIOS</span>
        <span>05 REGIÕES</span>
        <span>PROTOCOLO DE COMANDO</span>
      </div>
    </section>
  );
}

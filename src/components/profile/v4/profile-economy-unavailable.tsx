import Link from "next/link";
import styles from "./profile-economy-unavailable.module.css";

export function ProfileEconomyUnavailable({
  surface,
}: {
  surface: "arsenal" | "store";
}) {
  const title = surface === "arsenal" ? "Arsenal temporariamente indisponível" : "Intendência temporariamente indisponível";
  const detail =
    surface === "arsenal"
      ? "Não foi possível sincronizar inventário e loadout agora. Seu Dossiê e os demais sistemas continuam disponíveis."
      : "Não foi possível sincronizar catálogo e Tesouraria agora. Seu Dossiê e os demais sistemas continuam disponíveis.";

  return (
    <section className={styles.state} data-profile-economy-state="unavailable" aria-labelledby="profile-economy-unavailable-title">
      <span className={styles.code} aria-hidden="true">SYNC // OFFLINE</span>
      <div className={styles.signal} aria-hidden="true"><i /><i /><i /></div>
      <h1 id="profile-economy-unavailable-title">{title}</h1>
      <p>{detail}</p>
      <div className={styles.actions}>
        <Link href="/profile">Voltar ao Dossiê</Link>
        <Link href={surface === "arsenal" ? "/profile/arsenal" : "/profile/store"}>Tentar novamente</Link>
      </div>
    </section>
  );
}

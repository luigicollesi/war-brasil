import Link from "next/link";
import type { ProfileSection, ProfileSnapshot, ProfileState } from "@/src/lib/profile/profile-data";
import { PROFILE_STATE_COPY } from "@/src/lib/profile/profile-data";
import { CommandInsignia } from "./command-insignia";
import styles from "./profile-hall.module.css";

type ProfileHallProps = {
  snapshot: ProfileSnapshot;
};

type EmptyFixtureProps = {
  label: string;
  title: string;
  reason: string;
  motif?: "archive" | "medals" | "rank";
};

function StateSeal({ state }: { state: ProfileState }) {
  const copy = PROFILE_STATE_COPY[state];

  return (
    <div className={styles.stateSeal} role="status">
      <span className={styles.stateLamp} aria-hidden="true" />
      <span>{copy.label}</span>
    </div>
  );
}

function EmptyFixture({ label, title, reason, motif = "archive" }: EmptyFixtureProps) {
  return (
    <section className={styles.fixture} aria-labelledby={`${motif}-title`}>
      <div className={styles.fixtureHeader}>
        <span className={styles.fixtureIndex} aria-hidden="true">0{motif === "rank" ? 1 : motif === "archive" ? 2 : 3}</span>
        <div>
          <p>{label}</p>
          <h2 id={`${motif}-title`}>{title}</h2>
        </div>
      </div>

      <div className={`${styles.fixtureObject} ${styles[`fixtureObject_${motif}`]}`} aria-hidden="true">
        {motif === "medals" ? (
          <>
            <span />
            <span />
            <span />
          </>
        ) : motif === "archive" ? (
          <>
            <i />
            <i />
            <i />
            <i />
          </>
        ) : (
          <span className={styles.rankDash}>—</span>
        )}
      </div>

      <p className={styles.fixtureReason}>{reason}</p>
      <span className={styles.unavailableTag}>Indisponível — sem fonte real</span>
    </section>
  );
}

function availabilityReason<T>(section: ProfileSection<T>, fallback: string) {
  return section.unavailableReason ?? fallback;
}

function NonIdentityState({ snapshot }: ProfileHallProps) {
  const copy = PROFILE_STATE_COPY[snapshot.state];

  return (
    <main className={styles.page}>
      <div className="wb-shell-inner">
        <section className={styles.standaloneState}>
          <StateSeal state={snapshot.state} />
          <p className="wb-kicker">Salão de Comando</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <Link className="wb-button wb-button--secondary" href="/">
            Retornar ao comando
          </Link>
        </section>
      </div>
    </main>
  );
}

export function ProfileHall({ snapshot }: ProfileHallProps) {
  if (!snapshot.identity) {
    return <NonIdentityState snapshot={snapshot} />;
  }

  const copy = PROFILE_STATE_COPY[snapshot.state];

  return (
    <main className={styles.page} data-profile-state={snapshot.state}>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <div className="wb-shell-inner">
        <section className={styles.heading} aria-labelledby="profile-title">
          <div>
            <p className="wb-kicker">Arquivo de identidade operacional</p>
            <h1 id="profile-title">Salão de Comando</h1>
          </div>
          <StateSeal state={snapshot.state} />
        </section>

        <section className={styles.hall} aria-label="Identidade do comandante">
          <div className={styles.wallLeft} aria-hidden="true">
            <span>COMANDO</span>
            <i />
            <span>BRASIL</span>
          </div>

          <div className={styles.identityStage}>
            <div className={styles.insigniaMount}>
              <span className={styles.mountLight} aria-hidden="true" />
              <CommandInsignia displayName={snapshot.identity.displayName} />
            </div>

            <div className={styles.identityCopy}>
              <p className={styles.overline}>Identidade pública</p>
              <h2>{snapshot.identity.displayName}</h2>
              <div className={styles.sourceRow}>
                <span className={styles.sourceBadge}>{snapshot.identity.sourceLabel}</span>
                <span>Substituição prevista: provedor de usuário autenticado</span>
              </div>
            </div>
          </div>

          <aside className={styles.registryPlate} aria-label="Estado do registro">
            <span className={styles.plateNumber}>REG / 01</span>
            <p>{copy.label}</p>
            <strong>{copy.title}</strong>
            <span>{copy.description}</span>
          </aside>
        </section>

        <div className={styles.brassLine} aria-hidden="true">
          <span />
        </div>

        <section className={styles.records} aria-label="Registros do perfil">
          <EmptyFixture
            motif="rank"
            label="Patente e progressão"
            title="Autoridade sem fabricação"
            reason={availabilityReason(
              snapshot.progression,
              "Nenhum sistema de progressão está conectado a este perfil.",
            )}
          />
          <EmptyFixture
            motif="archive"
            label="Campanhas e histórico"
            title="Arquivo de campanhas"
            reason={availabilityReason(
              snapshot.history,
              "Nenhum histórico de partidas está conectado a este perfil.",
            )}
          />
          <EmptyFixture
            motif="medals"
            label="Honrarias"
            title="Parede de reconhecimento"
            reason={availabilityReason(
              snapshot.achievements,
              "Nenhum sistema de conquistas está conectado a este perfil.",
            )}
          />
        </section>

        <section className={styles.integrityRail} aria-label="Integridade dos dados">
          <div>
            <span className={styles.integrityMark} aria-hidden="true">✓</span>
            <div>
              <p>Integridade do arquivo</p>
              <strong>Nenhuma patente, ranking, estatística ou conquista foi simulada.</strong>
            </div>
          </div>
          <p>
            Estatísticas competitivas permanecem fora da composição até existir uma fonte de
            verdade no produto.
          </p>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import type {
  ProfileAchievement,
  ProfileCampaign,
  ProfileSection,
  ProfileSnapshot,
  ProfileState,
} from "@/src/lib/profile/profile-data";
import { PROFILE_STATE_COPY } from "@/src/lib/profile/profile-data";
import { CommandInsignia } from "./command-insignia";
import styles from "./profile-hall.module.css";

type ProfileHallProps = {
  snapshot: ProfileSnapshot;
};

type RecordFixtureProps = {
  label: string;
  title: string;
  motif: "archive" | "medals" | "rank";
  availability: "available" | "empty" | "unavailable";
  unavailableReason?: string;
  children?: React.ReactNode;
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

function EmptyMotif({ motif }: { motif: RecordFixtureProps["motif"] }) {
  return (
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
  );
}

function RecordFixture({
  label,
  title,
  motif,
  availability,
  unavailableReason,
  children,
}: RecordFixtureProps) {
  const index = motif === "rank" ? "01" : motif === "archive" ? "02" : "03";
  const titleId = `${motif}-title`;

  return (
    <section className={styles.fixture} aria-labelledby={titleId}>
      <div className={styles.fixtureHeader}>
        <span className={styles.fixtureIndex} aria-hidden="true">{index}</span>
        <div>
          <p>{label}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
      </div>

      {availability === "available" ? children : <EmptyMotif motif={motif} />}

      {availability === "unavailable" ? (
        <>
          <p className={styles.fixtureReason}>
            {unavailableReason ?? "Este registro ainda não possui uma fonte de dados disponível."}
          </p>
          <span className={styles.unavailableTag}>Indisponível — sem fonte real</span>
        </>
      ) : null}

      {availability === "empty" ? (
        <>
          <p className={styles.fixtureReason}>A fonte está disponível, mas ainda não há registros.</p>
          <span className={styles.emptyTag}>Arquivo disponível — sem registros</span>
        </>
      ) : null}
    </section>
  );
}

function CampaignList({ campaigns, hasMore }: { campaigns: ReadonlyArray<ProfileCampaign>; hasMore: boolean }) {
  return (
    <div className={styles.ledger}>
      <ol>
        {campaigns.map((campaign) => (
          <li key={`${campaign.title}-${campaign.summary}`}>
            <strong>{campaign.title}</strong>
            <span>{campaign.summary}</span>
          </li>
        ))}
      </ol>
      {hasMore ? <p>Há registros adicionais; a fonte deve fornecê-los progressivamente.</p> : null}
    </div>
  );
}

function AchievementList({ achievements }: { achievements: ReadonlyArray<ProfileAchievement> }) {
  return (
    <div className={styles.ledger}>
      <ol>
        {achievements.map((achievement) => (
          <li key={`${achievement.name}-${achievement.description}`}>
            <strong>{achievement.name}</strong>
            <span>{achievement.description}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatisticsLedger({ statistics }: { statistics: ProfileSnapshot["statistics"] }) {
  if (statistics.availability !== "available" || statistics.data.length === 0) {
    return null;
  }

  return (
    <dl className={styles.statisticsLedger} aria-label="Estatísticas verificadas">
      {statistics.data.map((statistic) => (
        <div key={`${statistic.label}-${statistic.value}`}>
          <dt>{statistic.label}</dt>
          <dd>{statistic.value}</dd>
        </div>
      ))}
    </dl>
  );
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

function sectionIsEmpty<T>(section: ProfileSection<T>) {
  return section.availability === "empty";
}

export function ProfileHall({ snapshot }: ProfileHallProps) {
  if (!snapshot.identity) {
    return <NonIdentityState snapshot={snapshot} />;
  }

  const copy = PROFILE_STATE_COPY[snapshot.state];
  const progressionAvailable =
    snapshot.progression.availability === "available" && snapshot.progression.data !== null;
  const historyAvailability =
    snapshot.history.availability === "available" && snapshot.history.data.campaigns.length === 0
      ? "empty"
      : snapshot.history.availability;
  const achievementsAvailability =
    snapshot.achievements.availability === "available" && snapshot.achievements.data.length === 0
      ? "empty"
      : snapshot.achievements.availability;

  return (
    <main
      className={styles.page}
      data-profile-state={snapshot.state}
      data-scene-fallback="html"
    >
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
            <StatisticsLedger statistics={snapshot.statistics} />
          </aside>
        </section>

        <div className={styles.brassLine} aria-hidden="true"><span /></div>

        <section className={styles.records} aria-label="Registros do perfil">
          <RecordFixture
            motif="rank"
            label="Patente e progressão"
            title="Autoridade registrada"
            availability={snapshot.progression.availability}
            unavailableReason={snapshot.progression.unavailableReason}
          >
            {progressionAvailable ? (
              <div className={styles.ledgerSingle}>
                <strong>{snapshot.progression.data?.title}</strong>
                {snapshot.progression.data?.detail ? <span>{snapshot.progression.data.detail}</span> : null}
              </div>
            ) : null}
          </RecordFixture>

          <RecordFixture
            motif="archive"
            label="Campanhas e histórico"
            title="Arquivo de campanhas"
            availability={historyAvailability}
            unavailableReason={snapshot.history.unavailableReason}
          >
            {snapshot.history.availability === "available" && snapshot.history.data.campaigns.length > 0 ? (
              <CampaignList campaigns={snapshot.history.data.campaigns} hasMore={snapshot.history.data.hasMore} />
            ) : null}
          </RecordFixture>

          <RecordFixture
            motif="medals"
            label="Honrarias"
            title="Parede de reconhecimento"
            availability={achievementsAvailability}
            unavailableReason={snapshot.achievements.unavailableReason}
          >
            {snapshot.achievements.availability === "available" && snapshot.achievements.data.length > 0 ? (
              <AchievementList achievements={snapshot.achievements.data} />
            ) : null}
          </RecordFixture>
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

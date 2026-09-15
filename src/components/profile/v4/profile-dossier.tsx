"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileCampaignStation } from "@/src/components/profile/command-quarters/profile-campaign-station";
import {
  commanderStatusLabel,
  initialsFrom,
} from "@/src/components/profile/command-quarters/profile-command-format";
import { ProfileNetworkStation } from "@/src/components/profile/command-quarters/profile-network-station";
import { ProfileSettingsPanel } from "@/src/components/profile/command-quarters/profile-settings-panel";
import type {
  MatchSummary,
  ProfileCommandSnapshot,
} from "@/src/lib/profile/profile-command-contract";
import styles from "./profile-dossier.module.css";

function activityLabel(snapshot: ProfileCommandSnapshot) {
  const identity = snapshot.identity.data;
  if (!identity) return "Atividade indisponível";
  if (identity.activity.state === "match") {
    return identity.activity.matchMode === "classic" ? "Em jogo clássico" : "Em partida personalizada";
  }
  if (identity.activity.state === "lobby") return "Preparando operação";
  if (identity.activity.state === "idle") return "Disponível no Quartel";
  return "Atividade indisponível";
}

export function ProfileDossier({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const identity = snapshot.identity.data;
  const privacy = snapshot.privacy.data;
  const [selectedOperation, setSelectedOperation] = useState<MatchSummary | null>(
    snapshot.history.data.matches[0] ?? null,
  );

  if (!identity) {
    return (
      <section className={styles.guestState} data-profile-v4-state="guest">
        <span className={styles.monogram} aria-hidden="true">WB</span>
        <p>ARQUIVO DE COMANDO</p>
        <h1>Identidade de comandante indisponível</h1>
        <span>{snapshot.identity.unavailableReason ?? "Uma sessão autenticada é necessária."}</span>
        <Link href="/">Retornar ao comando</Link>
      </section>
    );
  }

  return (
    <div className={styles.dossier} data-profile-v4-surface="dossier">
      <section className={styles.identityPanel} aria-labelledby="dossier-title">
        <div className={styles.identitySignal} aria-hidden="true">
          <span className={styles.monogram}>{initialsFrom(identity.displayName)}</span>
          <i />
        </div>

        <div className={styles.identityMain}>
          <div className={styles.eyebrowRow}>
            <span>DOSSIÊ // COMANDANTE</span>
            <span className={styles.presence} data-presence={identity.presence.state}>
              <i aria-hidden="true" />
              {commanderStatusLabel(identity.presence, identity.activity)}
            </span>
          </div>
          <h1 id="dossier-title">{identity.displayName}</h1>
          <div className={styles.identityMeta}>
            <span>@{identity.handle}</span>
            <span aria-hidden="true">/</span>
            <strong>{identity.title ?? "Sem título equipado"}</strong>
          </div>
          <p className={styles.bio}>
            {identity.bio ?? "Nenhum registro biográfico foi adicionado a este Dossiê."}
          </p>
        </div>

        <aside className={styles.identityStatus} aria-label="Estado operacional">
          <div>
            <small>ESTADO</small>
            <strong>{activityLabel(snapshot)}</strong>
          </div>
          <div>
            <small>REDE</small>
            <strong>
              {snapshot.social.availability === "unavailable"
                ? "Indisponível"
                : `${snapshot.social.data.totalFriends} aliados`}
            </strong>
          </div>
          <div>
            <small>CAMPANHAS</small>
            <strong>
              {snapshot.history.availability === "unavailable"
                ? "Indisponível"
                : `${snapshot.history.data.matches.length} recentes`}
            </strong>
          </div>
          {privacy && !snapshot.isEvaluationFixture ? (
            <div className={styles.settingsSlot}>
              <small>AJUSTAR DOSSIÊ</small>
              <ProfileSettingsPanel identity={identity} privacy={privacy} />
            </div>
          ) : null}
        </aside>
      </section>

      <div className={styles.secondaryGrid}>
        <section className={styles.module} aria-labelledby="network-module-title">
          <header className={styles.moduleHeader}>
            <span>
              <small>COMUNICAÇÕES</small>
              <h2 id="network-module-title">Rede de Comando</h2>
            </span>
            <strong>{snapshot.social.data.totalFriends.toString().padStart(2, "0")}</strong>
          </header>
          <div className={styles.moduleBody}>
            <ProfileNetworkStation snapshot={snapshot} />
          </div>
        </section>

        <section className={styles.module} aria-labelledby="history-module-title">
          <header className={styles.moduleHeader}>
            <span>
              <small>MEMÓRIA OPERACIONAL</small>
              <h2 id="history-module-title">Livro de Campanha</h2>
            </span>
            <strong>{snapshot.history.data.matches.length.toString().padStart(2, "0")}</strong>
          </header>
          <div className={styles.moduleBody}>
            <ProfileCampaignStation
              snapshot={snapshot}
              selected={selectedOperation?.operationCode ?? null}
              onSelect={setSelectedOperation}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

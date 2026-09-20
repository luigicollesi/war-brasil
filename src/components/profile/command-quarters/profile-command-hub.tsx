"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import type {
  MatchSummary,
  ProfileCommandSnapshot,
  ProfileCommandStation,
  StoreItemPreview,
} from "@/src/lib/profile/profile-command-contract";
import { ProfileCampaignStation } from "./profile-campaign-station";
import {
  commanderStatusLabel,
  formatBalance,
  initialsFrom,
} from "./profile-command-format";
import styles from "./profile-command-hub.module.css";
import { ProfileNetworkStation } from "./profile-network-station";
import { ProfileQuartermasterStation } from "./profile-quartermaster-station";

const STATIONS: ReadonlyArray<{
  id: ProfileCommandStation;
  label: string;
  shortLabel: string;
}> = [
  { id: "dossier", label: "Dossiê", shortLabel: "IDENT" },
  { id: "treasury", label: "Tesouraria", shortLabel: "TESOU" },
  { id: "network", label: "Rede de Comando", shortLabel: "REDE" },
  { id: "campaigns", label: "Livro de Campanha", shortLabel: "CAMP" },
  { id: "quartermaster", label: "Intendência", shortLabel: "INTEND" },
];

const SCENE_DIRECTIVES = {
  dossier: {
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  },
  treasury: {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 0,
  },
  network: {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0.04,
    orbitalAlignment: 1,
  },
  campaigns: {
    focus: "brazil",
    conflictLevel: 0,
    territoryExplode: 0.12,
    orbitalAlignment: 0,
  },
  quartermaster: {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  },
} as const;

function IdentityMark({ name }: { name: string }) {
  return (
    <span className={styles.guestMark} aria-label={`Monograma de ${name}`}>
      {initialsFrom(name)}
    </span>
  );
}

function StationFrame({
  station,
  activeStation,
  eyebrow,
  title,
  className,
  onActivate,
  children,
}: {
  station: ProfileCommandStation;
  activeStation: ProfileCommandStation;
  eyebrow: string;
  title: string;
  className?: string;
  onActivate: (station: ProfileCommandStation) => void;
  children: ReactNode;
}) {
  const active = station === activeStation;

  return (
    <section
      className={[styles.station, className].filter(Boolean).join(" ")}
      data-station={station}
      data-active={active ? "true" : "false"}
      aria-labelledby={`${station}-station-title`}
    >
      <button
        className={styles.stationHeader}
        type="button"
        onClick={() => onActivate(station)}
        aria-pressed={active}
      >
        <span>
          <small>{eyebrow}</small>
          <strong id={`${station}-station-title`}>{title}</strong>
        </span>
        <i aria-hidden="true">{active ? "ACTIVE" : "OPEN"}</i>
      </button>
      <div className={styles.stationBody}>{children}</div>
    </section>
  );
}

function CampaignCreditMark({ compact }: { compact: boolean }) {
  const size = compact ? 24 : 28;
  return (
    <span
      aria-hidden="true"
      data-campaign-credit-mark="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        backgroundImage: 'url("/coin.svg")',
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
      }}
    />
  );
}

function TreasuryReadout({
  snapshot,
  compact = false,
}: {
  snapshot: ProfileCommandSnapshot;
  compact?: boolean;
}) {
  const wallet = snapshot.wallet.data;

  if (snapshot.wallet.availability === "unavailable" || !wallet) {
    if (compact) {
      return <span className={styles.walletUnavailableCompact}>Tesouraria indisponível</span>;
    }

    return (
      <div className={styles.unavailableState}>
        <span>TESOURARIA INDISPONÍVEL</span>
        <small>{snapshot.wallet.unavailableReason ?? "Saldo sem fonte disponível."}</small>
      </div>
    );
  }

  const currency = wallet.campaignCredit;

  if (compact) {
    return (
      <span className={styles.walletCompact}>
        <span
          key={currency.currency}
          data-currency={currency.currency}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 112,
            minHeight: 42,
            padding: "5px 12px",
            borderLeft: "1px solid rgb(238 232 218 / 8%)",
            background: "rgb(5 10 7 / 48%)",
          }}
        >
          <CampaignCreditMark compact />
          <span>
            <small>{currency.shortLabel}</small>
            <strong>{formatBalance(currency.balance)}</strong>
          </span>
        </span>
      </span>
    );
  }

  return (
    <div className={styles.walletExpanded}>
      <div data-currency={currency.currency}>
        <CampaignCreditMark compact={false} />
        <span>
          <small>{currency.label}</small>
          <strong>{formatBalance(currency.balance)}</strong>
        </span>
      </div>
    </div>
  );
}

function DossierStation({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const identity = snapshot.identity.data;
  if (!identity) return null;

  return (
    <div className={styles.dossierContent}>
      <IdentityMark name={identity.displayName} />
      <div className={styles.identityCopy}>
        <span className={styles.presence} data-presence={identity.presence.state}>
          <i aria-hidden="true" />
          {commanderStatusLabel(identity.presence, identity.activity)}
        </span>
        <h1>{identity.displayName}</h1>
        <p>{identity.title ?? "Sem título equipado"}</p>
        <small>@{identity.handle}</small>
      </div>
      <div className={styles.identityStamp} aria-hidden="true">
        <span>ARQUIVO</span>
        <strong>01</strong>
      </div>
    </div>
  );
}

function campaignResultLabel(result: MatchSummary["result"]) {
  if (result === "victory") return "Vitória";
  if (result === "defeat") return "Derrota";
  return "Resultado indisponível";
}

function CommandTable({
  snapshot,
  activeStation,
  selectedOperation,
  selectedItem,
}: {
  snapshot: ProfileCommandSnapshot;
  activeStation: ProfileCommandStation;
  selectedOperation: MatchSummary | null;
  selectedItem: StoreItemPreview | null;
}) {
  const identity = snapshot.identity.data;
  const wallet = snapshot.wallet.data;

  const context = useMemo(() => {
    if (activeStation === "dossier") {
      return {
        kicker: "Identidade em foco",
        title: identity?.displayName ?? "Comandante",
        detail: identity?.title ?? "Dossiê pessoal",
        glyph: identity ? initialsFrom(identity.displayName) : "ID",
      };
    }

    if (activeStation === "treasury") {
      const currency = wallet?.campaignCredit;
      return {
        kicker: "Tesouraria aberta",
        title: "Créditos de Campanha",
        detail: currency
          ? `${formatBalance(currency.balance)} créditos disponíveis`
          : "Sem saldo disponível",
        glyph: "¤",
      };
    }

    if (activeStation === "network") {
      return {
        kicker: "Rede operacional",
        title: "Linhas de comando",
        detail:
          snapshot.social.availability === "unavailable"
            ? "Rede sem fonte disponível"
            : `${snapshot.social.data.totalFriends} contatos registrados`,
        glyph: "⌁",
      };
    }

    if (activeStation === "campaigns") {
      return {
        kicker: "Memória operacional",
        title: selectedOperation?.operationCode ?? "Livro de Campanha",
        detail: selectedOperation
          ? `${campaignResultLabel(selectedOperation.result)} · ${selectedOperation.durationMinutes} min`
          : snapshot.history.availability === "unavailable"
            ? "Histórico sem fonte disponível"
            : `${snapshot.history.data.matches.length} registros recentes`,
        glyph: "BR",
      };
    }

    return {
      kicker: "Intendência",
      title: selectedItem?.name ?? "Remessas em destaque",
      detail: selectedItem
        ? selectedItem.status === "announced"
          ? `EM BREVE · ${selectedItem.itemCount} itens`
          : `${selectedItem.itemCount} itens disponíveis`
        : snapshot.storefront.availability === "unavailable"
          ? "Vitrine sem fonte disponível"
          : `${snapshot.storefront.data.featuredItems.length} remessas em vitrine`,
      glyph: "▣",
    };
  }, [activeStation, identity, selectedItem, selectedOperation, snapshot, wallet]);

  return (
    <section className={styles.commandCore} aria-labelledby="command-table-title">
      <div className={styles.commandCoreHeader}>
        <span>Mesa de Comando Pessoal</span>
        <strong id="command-table-title">{context.kicker}</strong>
      </div>
      <div className={styles.commandTableVisual} data-station={activeStation} aria-hidden="true">
        <span className={styles.orbitA} />
        <span className={styles.orbitB} />
        <span className={styles.orbitC} />
        <span className={styles.tableGlyph}>{context.glyph}</span>
        <i className={styles.nodeOne} />
        <i className={styles.nodeTwo} />
        <i className={styles.nodeThree} />
        <i className={styles.nodeFour} />
      </div>
      <div className={styles.commandContext}>
        <strong>{context.title}</strong>
        <span>{context.detail}</span>
      </div>
      {activeStation === "treasury" ? <TreasuryReadout snapshot={snapshot} /> : null}
    </section>
  );
}

export function ProfileCommandHub({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const [activeStation, setActiveStation] = useState<ProfileCommandStation>("dossier");
  const [selectedOperation, setSelectedOperation] = useState<MatchSummary | null>(
    snapshot.history.data.matches[0] ?? null,
  );
  const [selectedItemSlug, setSelectedItemSlug] = useState<string | null>(
    snapshot.storefront.data.featuredItems[0]?.slug ?? null,
  );

  useCommandSceneDirective(SCENE_DIRECTIVES[activeStation]);

  const selectedItem =
    snapshot.storefront.data.featuredItems.find((item) => item.slug === selectedItemSlug) ?? null;

  if (snapshot.identity.availability === "unavailable" || !snapshot.identity.data) {
    return (
      <main
        className={styles.guestState}
        data-profile-command-state="guest"
        data-scene-fallback="html"
      >
        <span className={styles.guestMark} aria-hidden="true">WB</span>
        <p>Quartel do Comandante</p>
        <h1>Nenhuma identidade de comando disponível</h1>
        <span>
          {snapshot.identity.unavailableReason ?? "A sessão ainda não possui um perfil disponível."}
        </span>
        <Link href="/">Retornar ao comando</Link>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      data-profile-command-state={snapshot.state}
      data-active-station={activeStation}
      data-evaluation-fixture={snapshot.isEvaluationFixture || undefined}
      data-scene-fallback="html"
    >
      <header className={styles.topBar}>
        <div className={styles.topIdentity}>
          <Link href="/" aria-label="Voltar ao comando">←</Link>
          <span>
            <small>Quartel do Comandante</small>
            <strong>{snapshot.identity.data.displayName}</strong>
          </span>
        </div>

        {snapshot.isEvaluationFixture ? (
          <span className={styles.evalBadge}>FIXTURE DE AVALIAÇÃO</span>
        ) : null}

        <button
          type="button"
          className={styles.walletButton}
          data-active={activeStation === "treasury" ? "true" : "false"}
          onClick={() => setActiveStation("treasury")}
          aria-pressed={activeStation === "treasury"}
          aria-label="Abrir Tesouraria"
        >
          <TreasuryReadout snapshot={snapshot} compact />
        </button>
      </header>

      <div className={styles.commandGrid}>
        <StationFrame
          station="dossier"
          activeStation={activeStation}
          eyebrow="Arquivo pessoal"
          title="Dossiê do Comandante"
          className={styles.dossierStation}
          onActivate={setActiveStation}
        >
          <DossierStation snapshot={snapshot} />
        </StationFrame>

        <CommandTable
          snapshot={snapshot}
          activeStation={activeStation}
          selectedOperation={selectedOperation}
          selectedItem={selectedItem}
        />

        <StationFrame
          station="network"
          activeStation={activeStation}
          eyebrow="Comunicações"
          title="Rede de Comando"
          className={styles.networkStation}
          onActivate={setActiveStation}
        >
          <ProfileNetworkStation snapshot={snapshot} />
        </StationFrame>

        <StationFrame
          station="campaigns"
          activeStation={activeStation}
          eyebrow="Memória operacional"
          title="Livro de Campanha"
          className={styles.campaignStation}
          onActivate={setActiveStation}
        >
          <ProfileCampaignStation
            snapshot={snapshot}
            selected={selectedOperation?.operationCode ?? null}
            onSelect={(match) => {
              setSelectedOperation(match);
              setActiveStation("campaigns");
            }}
          />
        </StationFrame>

        <StationFrame
          station="quartermaster"
          activeStation={activeStation}
          eyebrow="Abastecimento"
          title="Intendência"
          className={styles.quartermasterStation}
          onActivate={setActiveStation}
        >
          <ProfileQuartermasterStation
            snapshot={snapshot}
            selectedSlug={selectedItemSlug}
            onSelect={(item) => {
              setSelectedItemSlug(item.slug);
              setActiveStation("quartermaster");
            }}
          />
        </StationFrame>
      </div>

      <nav className={styles.mobileSystems} aria-label="Sistemas do Quartel">
        {STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            onClick={() => setActiveStation(station.id)}
            data-active={activeStation === station.id ? "true" : "false"}
            aria-pressed={activeStation === station.id}
          >
            <span aria-hidden="true">{station.shortLabel}</span>
            <small>{station.label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}

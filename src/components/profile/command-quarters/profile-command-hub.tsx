"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import type {
  CommanderSearchResult,
  MatchSummary,
  PlayerPresence,
  ProfileCommandSnapshot,
  ProfileCommandStation,
  StoreItemPreview,
} from "@/src/lib/profile/profile-command-contract";
import styles from "./profile-command-hub.module.css";

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

const PRESENCE_COPY: Readonly<Record<PlayerPresence, string>> = {
  online: "Disponível",
  "in-lobby": "Em sala",
  "in-match": "Em partida",
  offline: "Offline",
};

function initialsFrom(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
      .join("") || "WB"
  );
}

function formatBalance(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatOperationDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(" de ", " ")
    .toLocaleUpperCase("pt-BR");
}

function Portrait({
  src,
  alt,
  name,
  className,
}: {
  src: string | null;
  alt: string;
  name: string;
  className?: string;
}) {
  return (
    <div className={[styles.portrait, className].filter(Boolean).join(" ")}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 640px) 96px, 150px" />
      ) : (
        <span aria-label={alt}>{initialsFrom(name)}</span>
      )}
      <i aria-hidden="true" />
    </div>
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
  children: React.ReactNode;
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

function TreasuryReadout({
  snapshot,
  compact = false,
}: {
  snapshot: ProfileCommandSnapshot;
  compact?: boolean;
}) {
  const wallet = snapshot.wallet.data;

  if (snapshot.wallet.availability === "unavailable" || !wallet) {
    return (
      <div className={styles.unavailableState}>
        <span>TESOURARIA INDISPONÍVEL</span>
        <small>{snapshot.wallet.unavailableReason ?? "Saldo sem fonte disponível."}</small>
      </div>
    );
  }

  return (
    <div className={compact ? styles.walletCompact : styles.walletExpanded}>
      {[wallet.common, wallet.premium].map((currency) => (
        <div key={currency.currency} data-currency={currency.currency}>
          <span className={styles.currencySymbol} aria-hidden="true">{currency.symbol}</span>
          <span>
            <small>{compact ? currency.shortLabel : currency.label}</small>
            <strong>{formatBalance(currency.balance)}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function DossierStation({ snapshot }: { snapshot: ProfileCommandSnapshot }) {
  const identity = snapshot.identity.data;
  if (!identity) return null;

  return (
    <div className={styles.dossierContent}>
      <Portrait
        src={identity.portrait.src}
        alt={identity.portrait.alt}
        name={identity.displayName}
      />
      <div className={styles.identityCopy}>
        <span className={styles.presence} data-presence={identity.presence}>
          <i aria-hidden="true" />
          {PRESENCE_COPY[identity.presence]}
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

function NetworkStation({
  snapshot,
  query,
  onQueryChange,
  results,
  searching,
  onSearch,
}: {
  snapshot: ProfileCommandSnapshot;
  query: string;
  onQueryChange: (value: string) => void;
  results: ReadonlyArray<CommanderSearchResult>;
  searching: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const social = snapshot.social.data;

  if (snapshot.social.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>REDE FORA DE SERVIÇO</span>
        <small>{snapshot.social.unavailableReason}</small>
      </div>
    );
  }

  return (
    <div className={styles.networkContent}>
      <div className={styles.rosterMeta}>
        <span>{social.friends.filter((friend) => friend.presence !== "offline").length} online</span>
        <span>{social.totalFriends} contatos</span>
        <span>{social.incomingRequests.length} sinais</span>
      </div>

      {snapshot.social.availability === "empty" ? (
        <div className={styles.emptyState}>
          <strong>Nenhum comandante conectado</strong>
          <span>A Central de Comunicações continua disponível para busca.</span>
        </div>
      ) : (
        <ul className={styles.friendList} aria-label="Amigos na Rede de Comando">
          {social.friends.slice(0, 4).map((friend) => (
            <li key={friend.handle}>
              <span className={styles.presenceDot} data-presence={friend.presence} aria-hidden="true" />
              <span>
                <strong>{friend.displayName}</strong>
                <small>{friend.contextLabel}</small>
              </span>
              <em>{PRESENCE_COPY[friend.presence]}</em>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.searchForm} onSubmit={onSearch}>
        <label htmlFor="commander-search">Localizar comandante</label>
        <div>
          <input
            id="commander-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="callsign / nome"
            autoComplete="off"
          />
          <button type="submit" disabled={query.trim().length < 2 || searching}>
            {searching ? "Rastreando" : "Rastrear"}
          </button>
        </div>
      </form>

      {results.length > 0 ? (
        <ul className={styles.searchResults} aria-label="Comandantes encontrados">
          {results.map((result) => (
            <li key={result.handle}>
              <span className={styles.searchMonogram} aria-hidden="true">
                {initialsFrom(result.displayName)}
              </span>
              <span>
                <strong>{result.displayName}</strong>
                <small>@{result.handle} · {result.mutualContacts} contatos em comum</small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CampaignStation({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: ProfileCommandSnapshot;
  selected: string | null;
  onSelect: (operationCode: string) => void;
}) {
  const history = snapshot.history.data;

  if (snapshot.history.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>ARQUIVO INDISPONÍVEL</span>
        <small>{snapshot.history.unavailableReason}</small>
      </div>
    );
  }

  if (snapshot.history.availability === "empty" || history.matches.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Nenhuma operação registrada</strong>
        <span>O Livro de Campanha está disponível e aguarda a primeira operação.</span>
      </div>
    );
  }

  return (
    <div className={styles.campaignContent}>
      <ol className={styles.operationList}>
        {history.matches.map((match) => (
          <li key={match.operationCode}>
            <button
              type="button"
              onClick={() => onSelect(match.operationCode)}
              data-selected={selected === match.operationCode ? "true" : "false"}
            >
              <span>
                <small>{formatOperationDate(match.playedAt)}</small>
                <strong>{match.operationCode}</strong>
              </span>
              <em data-result={match.result}>
                {match.result === "victory" ? "Vitória" : "Derrota"}
              </em>
              <span>
                <small>{match.mode === "classic" ? "Clássico" : "Personalizada"}</small>
                <strong>{match.durationMinutes} min</strong>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {history.hasMore ? <p className={styles.moreRecords}>Arquivo possui operações adicionais.</p> : null}
    </div>
  );
}

function QuartermasterStation({
  snapshot,
  selectedSlug,
  onSelect,
}: {
  snapshot: ProfileCommandSnapshot;
  selectedSlug: string | null;
  onSelect: (item: StoreItemPreview) => void;
}) {
  const items = snapshot.storefront.data.featuredItems;

  if (snapshot.storefront.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>INTENDÊNCIA INDISPONÍVEL</span>
        <small>{snapshot.storefront.unavailableReason}</small>
      </div>
    );
  }

  if (snapshot.storefront.availability === "empty" || items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Nenhuma remessa ativa</strong>
        <span>A Intendência permanece operacional sem produtos em destaque.</span>
      </div>
    );
  }

  return (
    <div className={styles.storeContent}>
      {items.slice(0, 3).map((item) => (
        <button
          key={item.slug}
          type="button"
          className={styles.storeItem}
          data-selected={selectedSlug === item.slug ? "true" : "false"}
          onClick={() => onSelect(item)}
        >
          <span className={styles.storeArtwork} aria-hidden="true">
            {item.category.slice(0, 2).toLocaleUpperCase("pt-BR")}
          </span>
          <span>
            <small>{item.category}</small>
            <strong>{item.name}</strong>
          </span>
          <em>{item.price.currency === "command-reserve" ? "◆" : "◈"} {formatBalance(item.price.amount)}</em>
        </button>
      ))}
      <p className={styles.storeDisclaimer}>Vitrine local · nenhuma compra é persistida nesta etapa.</p>
    </div>
  );
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
      return {
        kicker: "Tesouraria aberta",
        title: "Reservas de campanha",
        detail: wallet ? `${wallet.common.symbol} ${formatBalance(wallet.common.balance)} · ${wallet.premium.symbol} ${formatBalance(wallet.premium.balance)}` : "Sem saldo disponível",
        glyph: "¤",
      };
    }

    if (activeStation === "network") {
      return {
        kicker: "Rede operacional",
        title: "Linhas de comando",
        detail: `${snapshot.social.data.totalFriends} contatos registrados`,
        glyph: "⌁",
      };
    }

    if (activeStation === "campaigns") {
      return {
        kicker: "Memória operacional",
        title: selectedOperation?.operationCode ?? "Livro de Campanha",
        detail: selectedOperation
          ? `${selectedOperation.result === "victory" ? "Vitória" : "Derrota"} · ${selectedOperation.durationMinutes} min`
          : `${snapshot.history.data.matches.length} operações recentes`,
        glyph: "BR",
      };
    }

    return {
      kicker: "Intendência",
      title: selectedItem?.name ?? "Remessas em destaque",
      detail: selectedItem
        ? `${selectedItem.price.currency === "command-reserve" ? "◆" : "◈"} ${formatBalance(selectedItem.price.amount)}`
        : `${snapshot.storefront.data.featuredItems.length} itens em vitrine`,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReadonlyArray<CommanderSearchResult>>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOperationCode, setSelectedOperationCode] = useState<string | null>(
    snapshot.history.data.matches[0]?.operationCode ?? null,
  );
  const [selectedItemSlug, setSelectedItemSlug] = useState<string | null>(
    snapshot.storefront.data.featuredItems[0]?.slug ?? null,
  );

  useCommandSceneDirective(SCENE_DIRECTIVES[activeStation]);

  const selectedOperation =
    snapshot.history.data.matches.find((match) => match.operationCode === selectedOperationCode) ?? null;
  const selectedItem =
    snapshot.storefront.data.featuredItems.find((item) => item.slug === selectedItemSlug) ?? null;

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;

    setSearching(true);
    try {
      const response = await fetch(
        `/api/profile/commanders/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      if (!response.ok) throw new Error("COMMANDER_SEARCH_FAILED");
      const payload = (await response.json()) as { results?: ReadonlyArray<CommanderSearchResult> };
      setSearchResults(payload.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  if (snapshot.identity.availability === "unavailable" || !snapshot.identity.data) {
    return (
      <main className={styles.guestState} data-profile-command-state="guest">
        <span className={styles.guestMark} aria-hidden="true">WB</span>
        <p>Quartel do Comandante</p>
        <h1>Nenhuma identidade de comando disponível</h1>
        <span>{snapshot.identity.unavailableReason ?? "A sessão ainda não possui um perfil disponível."}</span>
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
          <NetworkStation
            snapshot={snapshot}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            searching={searching}
            onSearch={handleSearch}
          />
        </StationFrame>

        <StationFrame
          station="campaigns"
          activeStation={activeStation}
          eyebrow="Memória operacional"
          title="Livro de Campanha"
          className={styles.campaignStation}
          onActivate={setActiveStation}
        >
          <CampaignStation
            snapshot={snapshot}
            selected={selectedOperationCode}
            onSelect={(operationCode) => {
              setSelectedOperationCode(operationCode);
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
          <QuartermasterStation
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
